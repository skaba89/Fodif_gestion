import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

/**
 * Sprint Enterprise 0, axe E4 (identité et sécurité entreprise, docs/14-ROADMAP-SAAS-PREMIUM.md) -
 * session revocation for the otherwise fully stateless JWT access token (session-token.service.ts
 * signs it, JwtAuthGuard verifies its signature and expiry, nothing else). Without this, logging
 * out only cleared the browser cookie (apps/web/app/api/session/logout/route.ts) - the token
 * itself stayed valid until its own natural expiry.
 *
 * Each token carries a unique `jti` claim (added at issue time). Revoking one records that jti in
 * `revoked_tokens` until the token's own expiry, after which the row is useless (the token would
 * be rejected on signature/exp grounds regardless) - so revoke() also opportunistically sweeps
 * expired rows rather than requiring a separate scheduled cleanup job.
 */
@Injectable()
export class RevocationService {
  constructor(private readonly db: DatabaseService) {}

  /** exp is a JWT `exp` claim - seconds since epoch. */
  async revoke(jti: string, userId: string, exp: number): Promise<void> {
    await this.db.query(
      `INSERT INTO revoked_tokens (jti, utilisateur_id, expires_at) VALUES ($1, $2, to_timestamp($3))
       ON CONFLICT (jti) DO NOTHING`,
      [jti, userId, exp],
    );
    // Opportunistic cleanup, not correctness-critical (isRevoked's own query is already scoped to
    // expires_at > NOW()) - keeps the table from growing unbounded without a separate cron job.
    await this.db.query('DELETE FROM revoked_tokens WHERE expires_at < NOW()');
  }

  async isRevoked(jti: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT 1 FROM revoked_tokens WHERE jti = $1 AND expires_at > NOW() LIMIT 1',
      [jti],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
