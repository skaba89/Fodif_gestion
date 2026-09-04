import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { DatabaseService } from '../database/database.service';

// @nestjs/throttler doesn't re-export ThrottlerStorageRecord from its package root (only from an
// internal file) - a structurally identical local type avoids importing an unexported deep path.
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Axe E4 (identité et sécurité entreprise, docs/14-ROADMAP-SAAS-PREMIUM.md) - rate limiting
 * distribué. @nestjs/throttler's own default `ThrottlerStorageService` keeps hits in an in-process
 * `Map`: with more than one API instance behind a load balancer (the production target - the
 * Docker Compose demo stack in this repo only ever runs one), each instance counts requests for
 * itself alone, so a real limit of N requests/window becomes N x (number of instances) in
 * practice, and an attacker who spreads requests across instances defeats it entirely. This is
 * most consequential on `/auth/login` (@Throttle() in auth.controller.ts) - the one control this
 * repo has against distributed credential stuffing.
 *
 * This implementation stores the shared state in PostgreSQL instead (database/
 * 020_distributed_rate_limiting.sql, table `rate_limit_hits`) - the one dependency every API
 * instance already has, so no new infrastructure component (Redis, ...) is introduced. It is a
 * standard fixed-window-with-block counter (increment a per-window count, block for
 * `blockDuration` once the count exceeds `limit`, reset on the next window or once the block
 * expires) - the same shape used by most distributed throttler backends. It is NOT a bit-for-bit
 * reimplementation of @nestjs/throttler's in-memory algorithm, which decays each hit individually
 * on its own per-hit timer (closer to a sliding window) - that per-hit timer model doesn't
 * translate to a stateless, horizontally-scaled backend without per-hit rows and a background
 * sweeper, which is a materially larger and slower design for the same practical guarantee this
 * axis needs: nobody exceeds `limit` requests per `ttl`, and an offender stays blocked for
 * `blockDuration`. Concurrency safety comes from `SELECT ... FOR UPDATE` inside a transaction (the
 * same lock-then-decide pattern used throughout this codebase - maker-checker, optimistic locking,
 * document verification), not from an atomic single-statement UPSERT, trading a little latency for
 * the same clarity and provable correctness as the rest of this codebase's concurrency-sensitive
 * code; a rate limiter is not a latency-critical hot path.
 *
 * `ThrottlerGuard` is a global `APP_GUARD` (app.module.ts) - every single request, on every route,
 * calls `increment()` before reaching its controller. That makes this storage's failure mode a
 * platform-wide one: unlike a security-critical control with low, well-defined traffic (e.g.
 * `ClamAvService`, which fails closed - see clamav.service.ts), failing closed here would turn a
 * transient database hiccup into a total outage of the entire API, on every route, for every user -
 * a worse outcome than the defense-in-depth rate limit itself being briefly unenforced. So this
 * fails open: a database error is logged and the request is allowed through unthrottled rather than
 * rejected with a 500. (Exercised for real by `test/app.e2e-spec.ts`, which boots the whole
 * `AppModule` - `ThrottlerGuard` included - without a configured database, the same way a route
 * with no reason to touch PostgreSQL still shouldn't need one just to pass through this guard.)
 */
@Injectable()
export class PostgresThrottlerStorageService implements ThrottlerStorage {
  private readonly logger = new Logger(PostgresThrottlerStorageService.name);

  constructor(private readonly db: DatabaseService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    try {
      return await this.performIncrement(key, ttl, limit, blockDuration, throttlerName);
    } catch (error) {
      this.logger.warn(
        `Rate limit storage unavailable, failing open for this request: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
    }
  }

  private async performIncrement(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    return this.db.transaction(async (client) => {
      const now = Date.now();
      // `SELECT ... FOR UPDATE` only locks a row that already exists - on a brand-new key there is
      // nothing to lock yet, so two concurrent first requests would both read "no row" and race to
      // insert, each computing totalHits=1 independently (a lost update). Guaranteeing the row
      // exists first closes that gap: `ON CONFLICT DO NOTHING` is safe under concurrency (the
      // loser waits on the winner's row lock, then no-ops), so by the time the SELECT below runs
      // there is always a real row to lock and serialize on.
      await client.query(
        `INSERT INTO rate_limit_hits (key, throttler_name, total_hits, expires_at, is_blocked, block_expires_at)
         VALUES ($1, $2, 0, NOW(), FALSE, NULL)
         ON CONFLICT (key, throttler_name) DO NOTHING`,
        [key, throttlerName],
      );
      const locked = await client.query<{ totalHits: number; expiresAt: Date; isBlocked: boolean; blockExpiresAt: Date | null }>(
        `SELECT total_hits AS "totalHits", expires_at AS "expiresAt", is_blocked AS "isBlocked", block_expires_at AS "blockExpiresAt"
         FROM rate_limit_hits WHERE key = $1 AND throttler_name = $2 FOR UPDATE`,
        [key, throttlerName],
      );
      const row = locked.rows[0];
      const rowBlockExpiresAt = row?.blockExpiresAt ? row.blockExpiresAt.getTime() : 0;
      const stillBlocked = Boolean(row?.isBlocked) && rowBlockExpiresAt > now;

      let totalHits: number;
      let expiresAt: number;
      let isBlocked: boolean;
      let blockExpiresAt: number;

      if (stillBlocked) {
        // Already blocked and the block hasn't lapsed yet: report the existing state without
        // counting another hit - mirrors the in-memory storage, which stops accumulating hits
        // for a key it has already blocked.
        totalHits = row!.totalHits;
        expiresAt = row!.expiresAt.getTime();
        isBlocked = true;
        blockExpiresAt = rowBlockExpiresAt;
      } else {
        // A block that just lapsed starts a fresh window too (matches the in-memory storage's
        // resetBlockdRequest + fireHitCount: it zeroes the hit count before counting this
        // request), not one more hit piled onto the stale, already-over-limit count.
        const blockJustExpired = Boolean(row?.isBlocked) && !stillBlocked;
        // totalHits === 0 also covers the placeholder row the ON CONFLICT DO NOTHING insert above
        // just created for a brand-new key: its expires_at is PostgreSQL's own NOW(), captured a
        // few milliseconds after the JS `now` above (network round trip) - comparing timestamps
        // alone could occasionally judge that placeholder "not yet expired" and keep its
        // already-elapsed expires_at instead of opening a real ttl-long window.
        const windowExpired = !row || row.totalHits === 0 || row.expiresAt.getTime() <= now || blockJustExpired;
        totalHits = (windowExpired ? 0 : row!.totalHits) + 1;
        expiresAt = windowExpired ? now + ttl : row!.expiresAt.getTime();
        isBlocked = totalHits > limit;
        blockExpiresAt = isBlocked ? now + blockDuration : 0;
      }

      await client.query(
        `INSERT INTO rate_limit_hits (key, throttler_name, total_hits, expires_at, is_blocked, block_expires_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (key, throttler_name) DO UPDATE SET
           total_hits = EXCLUDED.total_hits, expires_at = EXCLUDED.expires_at,
           is_blocked = EXCLUDED.is_blocked, block_expires_at = EXCLUDED.block_expires_at, updated_at = NOW()`,
        [key, throttlerName, totalHits, new Date(expiresAt), isBlocked, blockExpiresAt ? new Date(blockExpiresAt) : null],
      );

      return {
        totalHits,
        timeToExpire: Math.max(0, Math.ceil((expiresAt - now) / 1000)),
        isBlocked,
        timeToBlockExpire: isBlocked ? Math.max(0, Math.ceil((blockExpiresAt - now) / 1000)) : 0,
      };
    });
  }
}
