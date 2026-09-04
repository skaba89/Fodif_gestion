import { createHash } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

interface IdempotencyRow {
  requestHash: string;
  responseBody: unknown;
}

/**
 * Sprint Enterprise 0, axe E5 (intégrité financière, docs/14-ROADMAP-SAAS-PREMIUM.md) - protects
 * a mutating financial endpoint against being executed twice for what the caller intends as one
 * submission: a double click, a browser retry after a timeout, or a network layer replaying the
 * same POST. Without this, `financings.service.ts#planDisbursement`/`#createRepayment` (and their
 * partner-portal equivalents) would each cheerfully create a second decaissement/remboursement
 * row for the same real-world payment, as long as the running total still fit under the
 * financing's ceiling - a real double-spend, not a theoretical one.
 *
 * Contract (database/015_idempotency_keys.sql): the caller supplies an `Idempotency-Key` header
 * once per submission intent and resends the SAME key on any retry of that same intent. The first
 * request to reach `run()` for a given (scope, key) pair - a `INSERT ... ON CONFLICT DO NOTHING`
 * race, decided by PostgreSQL, not by application-level locking - actually executes `handler()`
 * and stores its result; every later request with the same key gets that stored result played
 * back, `handler()` never runs again. A key is optional: an endpoint called without one behaves
 * exactly as before this axis existed (no dedup, no behaviour change) - this only tightens
 * behaviour for callers that opt in by sending the header, never widens it for anyone else.
 *
 * Reusing the same key for a genuinely different payload (a real bug, not a legitimate retry) is
 * refused with 409 rather than silently returning the wrong stored response or executing the new
 * one anyway - `empreinte_requete` (a SHA-256 of the normalized payload) is compared before ever
 * replaying a cached result.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly db: DatabaseService) {}

  async run<T>(scope: string, key: string | undefined, userId: string, payload: unknown, handler: () => Promise<T>): Promise<T> {
    if (!key) return handler();
    const requestHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');

    const claim = await this.db.query<{ id: string }>(
      `INSERT INTO idempotency_keys (scope, cle, utilisateur_id, empreinte_requete)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (scope, cle) DO NOTHING
       RETURNING id`,
      [scope, key, userId, requestHash],
    );

    if (claim.rows[0]) {
      // We won the race for this key - actually run the operation.
      try {
        const result = await handler();
        await this.db.query(
          `UPDATE idempotency_keys SET statut_reponse = 200, corps_reponse = $2, completed_at = NOW() WHERE id = $1`,
          [claim.rows[0].id, JSON.stringify(result)],
        );
        return result;
      } catch (error) {
        // A failed attempt (validation error, conflict, transient DB issue) must stay retryable
        // under the same key - only a successful write is idempotency-protected, an error is not
        // "the outcome" a retry should be handed back verbatim.
        await this.db.query(`DELETE FROM idempotency_keys WHERE id = $1`, [claim.rows[0].id]);
        throw error;
      }
    }

    // Someone else already claimed this key (a genuine concurrent retry, or the exact same
    // request replayed later) - look up what happened rather than executing handler() again.
    const existing = await this.db.query<IdempotencyRow>(
      `SELECT empreinte_requete AS "requestHash", corps_reponse AS "responseBody"
       FROM idempotency_keys WHERE scope = $1 AND cle = $2 AND statut_reponse IS NOT NULL`,
      [scope, key],
    );
    const row = existing.rows[0];
    if (!row) {
      // The claim exists but hasn't completed yet (still mid-flight) or was rolled back and not
      // yet retried - either way, this is not this request's job to execute the write.
      throw new ConflictException('This request is already being processed with the same idempotency key. Retry shortly.');
    }
    if (row.requestHash !== requestHash) {
      throw new ConflictException('This idempotency key was already used with a different request payload.');
    }
    return row.responseBody as T;
  }
}
