import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveJwtSigningKeys } from '../security-policy';

/**
 * Axe E4 (docs/14-ROADMAP-SAAS-PREMIUM.md) - JWT signing key rotation. Resolves once, at
 * construction, which secret new tokens are signed with (`signingSecret`/`signingKeyId`) and
 * which secrets are still accepted for verification (`resolveVerificationSecret`) - the current
 * one always, plus JWT_SECRET_PREVIOUS's if set, letting an operator rotate JWT_SECRET without
 * invalidating tokens already handed out. See security-policy.js#resolveJwtSigningKeys for the
 * key-id scheme and why this is scoped to JWT signing only, not the derived PII/MFA/OIDC secrets.
 *
 * Shared by AuthModule's JwtModule.registerAsync (signing - see auth.module.ts) and
 * JwtAuthGuard (verification), so both sides of a token's lifecycle read the exact same key set.
 */
@Injectable()
export class JwtKeyResolverService {
  private readonly currentKid: string;
  private readonly keys: Map<string, string>;

  constructor(config: ConfigService) {
    const { currentKid, keys } = resolveJwtSigningKeys(
      config.get<string>('JWT_SECRET'),
      config.get<string>('JWT_SECRET_PREVIOUS'),
      config.get<string>('NODE_ENV'),
    );
    this.currentKid = currentKid;
    this.keys = new Map(Object.entries(keys));
  }

  get signingKeyId(): string {
    return this.currentKid;
  }

  get signingSecret(): string {
    // Always present: resolveJwtSigningKeys always seeds `keys` with the current key id.
    return this.keys.get(this.currentKid) as string;
  }

  /**
   * Picks the secret to verify a token against, given the `kid` from its (unverified) header.
   * Falls back to the current secret when there is no `kid` (a token issued before this axis) or
   * it doesn't match one of our own known keys - the same behaviour as before this axis existed,
   * and safe: an attacker-supplied `kid` can only ever select one of our own keys, never anything
   * else, so this never widens what a forged token could get accepted with.
   */
  resolveVerificationSecret(kid: string | undefined): string {
    if (kid && this.keys.has(kid)) return this.keys.get(kid) as string;
    return this.signingSecret;
  }
}
