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
 * 020_distributed_rate_limiting.sql) - the one dependency every API instance already has, so no
 * new infrastructure component (Redis, ...) is introduced. It is a genuine SLIDING window, one row
 * per counted request (`rate_limit_hits`, each row live for exactly `ttl` after its own request),
 * not a fixed window with one aggregate counter per key - a fixed-window version was tried first
 * and found wanting for real, not by inspection: the CI job "Docker Compose, Playwright et audit
 * des images" failed `company-profile.spec.ts` on the Pixel 7/iPhone 14 projects, because
 * `playwright.config.ts` (see its `HEAVY_LOGIN_SPECS` comment) deliberately relies on the true
 * sliding decay of the original in-memory storage so that logins spread out across a long test run
 * never pile up inside one window - a fixed window's "everything since the window opened counts
 * together" is a materially different, stricter guarantee than the sliding one this whole platform
 * (this test suite included) was built against, not an equivalent reimplementation. Concurrency
 * safety for a given key comes from a transaction-scoped PostgreSQL advisory lock
 * (`pg_advisory_xact_lock`, keyed by a hash of `key`+`throttlerName`) rather than `SELECT ... FOR
 * UPDATE` on a row (there is no single row representing a key here, only however many hit rows are
 * currently live for it) - held only for the duration of one `increment()` transaction, released
 * automatically on commit/rollback, and cheap even under contention since it never touches disk.
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
      // Serializes every increment() for this exact (key, throttlerName) pair - held only for this
      // transaction, released automatically on commit/rollback. No row to lock (there may be zero,
      // one, or many live hit rows for this key), so a row lock doesn't apply here the way it does
      // elsewhere in this codebase's lock-then-decide code.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${throttlerName}::${key}`]);

      const blockRow = await client.query<{ blockExpiresAt: Date }>(
        'SELECT block_expires_at AS "blockExpiresAt" FROM rate_limit_blocks WHERE key = $1 AND throttler_name = $2',
        [key, throttlerName],
      );
      const blockExpiresAt = blockRow.rows[0]?.blockExpiresAt.getTime() ?? 0;
      const stillBlocked = blockExpiresAt > now;

      if (stillBlocked) {
        // Already blocked and the block hasn't lapsed: report the current sliding count without
        // adding a new hit - mirrors the in-memory storage, which stops accumulating hits for a
        // key it has already blocked (existing hits still age out on their own below).
        const activeHits = await client.query<{ totalHits: string; oldestExpiresAt: Date | null }>(
          `SELECT COUNT(*) AS "totalHits", MIN(expires_at) AS "oldestExpiresAt"
           FROM rate_limit_hits WHERE key = $1 AND throttler_name = $2 AND expires_at > NOW()`,
          [key, throttlerName],
        );
        const totalHits = Number(activeHits.rows[0].totalHits);
        const oldestExpiresAt = activeHits.rows[0].oldestExpiresAt?.getTime() ?? now;
        return {
          totalHits,
          timeToExpire: Math.max(0, Math.ceil((oldestExpiresAt - now) / 1000)),
          isBlocked: true,
          timeToBlockExpire: Math.max(0, Math.ceil((blockExpiresAt - now) / 1000)),
        };
      }

      if (blockExpiresAt > 0) {
        // A block that just lapsed wipes this key's slate clean entirely, not just its expired
        // hits - mirrors the in-memory storage's resetBlockdRequest, which zeroes the hit count
        // outright once a block ends rather than letting pre-block hits keep sliding-decaying.
        // Without this, hits from just before the block (still within ttl) would immediately
        // re-trigger it the moment the block itself lapses.
        await client.query('DELETE FROM rate_limit_blocks WHERE key = $1 AND throttler_name = $2', [key, throttlerName]);
        await client.query('DELETE FROM rate_limit_hits WHERE key = $1 AND throttler_name = $2', [key, throttlerName]);
      } else {
        // Sweep this key's own already-expired hits before counting - keeps the table from
        // growing unbounded without needing a separate purge job for the common case (see the
        // migration's comment for the one gap this doesn't cover: a key that stops being hit
        // entirely).
        await client.query('DELETE FROM rate_limit_hits WHERE key = $1 AND throttler_name = $2 AND expires_at <= NOW()', [key, throttlerName]);
      }
      await client.query('INSERT INTO rate_limit_hits (key, throttler_name, expires_at) VALUES ($1, $2, $3)', [
        key,
        throttlerName,
        new Date(now + ttl),
      ]);

      const activeHits = await client.query<{ totalHits: string; oldestExpiresAt: Date }>(
        `SELECT COUNT(*) AS "totalHits", MIN(expires_at) AS "oldestExpiresAt" FROM rate_limit_hits WHERE key = $1 AND throttler_name = $2`,
        [key, throttlerName],
      );
      const totalHits = Number(activeHits.rows[0].totalHits);
      const oldestExpiresAt = activeHits.rows[0].oldestExpiresAt.getTime();
      const isBlocked = totalHits > limit;

      if (isBlocked) {
        await client.query(
          `INSERT INTO rate_limit_blocks (key, throttler_name, block_expires_at) VALUES ($1, $2, $3)
           ON CONFLICT (key, throttler_name) DO UPDATE SET block_expires_at = EXCLUDED.block_expires_at`,
          [key, throttlerName, new Date(now + blockDuration)],
        );
      }

      return {
        totalHits,
        timeToExpire: Math.max(0, Math.ceil((oldestExpiresAt - now) / 1000)),
        isBlocked,
        timeToBlockExpire: isBlocked ? Math.max(0, Math.ceil(blockDuration / 1000)) : 0,
      };
    });
  }
}
