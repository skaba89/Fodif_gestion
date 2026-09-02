import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as OTPAuth from 'otpauth';
import { decryptWithKey, deriveSecret, encryptWithKey, resolveJwtSecret } from '../../security-policy';
import { AuthUserRecord, UsersRepository } from '../../users/users.repository';
import { SessionTokenService } from '../session-token.service';

type MfaChallengePurpose = 'mfa_setup' | 'mfa_login';

interface MfaChallengePayload {
  sub: string;
  purpose: MfaChallengePurpose;
}

export interface MfaSetupChallenge {
  mfaSetupRequired: true;
  mfaChallenge: string;
  secret: string;
  otpauthUrl: string;
}

export interface MfaLoginChallenge {
  mfaRequired: true;
  mfaChallenge: string;
}

const CHALLENGE_TTL_SECONDS = 5 * 60;
const CHALLENGE_AUDIENCE = 'fodip-mfa';
const TOTP_ISSUER = 'FODIP Digital 2030';

/**
 * TOTP-based second factor for accounts flagged `mfa_required`.
 *
 * Login flow when MFA is required:
 *  1. AuthService verifies email/password as usual, then hands off to beginChallenge().
 *  2. If the account has no confirmed TOTP seed yet, a setup challenge is returned together
 *     with the seed (base32) and its otpauth:// URI: the client must submit one valid code via
 *     POST /auth/mfa/confirm to finish enrollment.
 *  3. Otherwise a login challenge is returned: the client must submit one valid code via
 *     POST /auth/mfa/verify.
 * Both challenge tokens are short-lived, purpose-scoped JWTs signed with a key derived from
 * JWT_SECRET (never the main signing key), so they cannot be reused as a bearer access token.
 */
@Injectable()
export class MfaService {
  private readonly encryptionKey: Buffer;
  private readonly challengeSecret: Buffer;

  constructor(
    config: ConfigService,
    private readonly users: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly sessions: SessionTokenService,
  ) {
    const jwtSecret = resolveJwtSecret(config.get<string>('JWT_SECRET'), config.get<string>('NODE_ENV'));
    this.encryptionKey = deriveSecret(jwtSecret, 'fodip-mfa-secret-encryption-v1');
    this.challengeSecret = deriveSecret(jwtSecret, 'fodip-mfa-challenge-v1');
  }

  async beginChallenge(user: AuthUserRecord): Promise<MfaSetupChallenge | MfaLoginChallenge> {
    if (!user.mfaConfirmedAt) {
      const secret = user.mfaSecretEncrypted
        ? decryptWithKey(user.mfaSecretEncrypted, this.encryptionKey)
        : await this.enrollNewSecret(user.id);
      const totp = this.buildTotp(user.email, secret);
      return {
        mfaSetupRequired: true,
        mfaChallenge: await this.issueChallenge(user.id, 'mfa_setup'),
        secret,
        otpauthUrl: totp.toString(),
      };
    }

    return {
      mfaRequired: true,
      mfaChallenge: await this.issueChallenge(user.id, 'mfa_login'),
    };
  }

  async confirmEnrollment(challenge: string, code: string) {
    const userId = await this.resolveChallenge(challenge, 'mfa_setup');
    const user = await this.users.findAuthenticatedById(userId);
    if (!user || !user.mfaSecretEncrypted || user.mfaConfirmedAt) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const secret = decryptWithKey(user.mfaSecretEncrypted, this.encryptionKey);
    await this.assertValidCodeAndConsume(user.id, user.email, secret, code);
    await this.users.confirmMfaSecret(user.id);
    return this.sessions.issue(user);
  }

  async verifyLogin(challenge: string, code: string) {
    const userId = await this.resolveChallenge(challenge, 'mfa_login');
    const user = await this.users.findAuthenticatedById(userId);
    if (!user || !user.mfaSecretEncrypted || !user.mfaConfirmedAt) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const secret = decryptWithKey(user.mfaSecretEncrypted, this.encryptionKey);
    await this.assertValidCodeAndConsume(user.id, user.email, secret, code);
    return this.sessions.issue(user);
  }

  private async enrollNewSecret(userId: string): Promise<string> {
    const secret = new OTPAuth.Secret({ size: 20 }).base32;
    await this.users.setPendingMfaSecret(userId, encryptWithKey(secret, this.encryptionKey));
    return secret;
  }

  private buildTotp(email: string, base32Secret: string): OTPAuth.TOTP {
    return new OTPAuth.TOTP({
      issuer: TOTP_ISSUER,
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(base32Secret),
    });
  }

  private async assertValidCodeAndConsume(userId: string, email: string, base32Secret: string, code: string): Promise<void> {
    const totp = this.buildTotp(email, base32Secret);
    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) throw new UnauthorizedException('Invalid verification code');

    const step = totp.counter({}) + delta;
    const consumed = await this.users.consumeMfaStep(userId, step);
    if (!consumed) throw new UnauthorizedException('Invalid verification code');
  }

  private issueChallenge(userId: string, purpose: MfaChallengePurpose): Promise<string> {
    const payload: MfaChallengePayload = { sub: userId, purpose };
    return this.jwtService.signAsync(payload, {
      secret: this.challengeSecret,
      expiresIn: CHALLENGE_TTL_SECONDS,
      audience: CHALLENGE_AUDIENCE,
      issuer: TOTP_ISSUER,
    });
  }

  private async resolveChallenge(token: string, purpose: MfaChallengePurpose): Promise<string> {
    try {
      const payload = await this.jwtService.verifyAsync<MfaChallengePayload>(token, {
        secret: this.challengeSecret,
        audience: CHALLENGE_AUDIENCE,
        issuer: TOTP_ISSUER,
      });
      if (payload.purpose !== purpose) throw new Error('purpose mismatch');
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired verification session');
    }
  }
}
