import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as OTPAuth from 'otpauth';
import {
  createPurposeKeyring,
  decryptVersionedWithKeyring,
  encryptVersionedWithKeyring,
  PurposeKeyring,
  resolveJwtSecret,
  resolvePurposeSecret,
} from '../../security-policy';
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
 * Both challenge tokens are short-lived, purpose-scoped JWTs signed with MFA_CHALLENGE_SECRET.
 * TOTP seeds use the independent MFA_SECRET_ENCRYPTION_KEY and a versioned AES-GCM envelope.
 * Legacy JWT-derived values remain readable only through the explicit migration keyring.
 */
@Injectable()
export class MfaService {
  private readonly encryptionKeys: PurposeKeyring;
  private readonly challengeKeys: PurposeKeyring;

  constructor(
    config: ConfigService,
    private readonly users: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly sessions: SessionTokenService,
  ) {
    const nodeEnvironment = config.get<string>('NODE_ENV');
    const appEnvironment = config.get<string>('APP_ENV');
    const jwtSecret = resolveJwtSecret(config.get<string>('JWT_SECRET'), nodeEnvironment);
    const jwtPreviousSecret = config.get<string>('JWT_SECRET_PREVIOUS');
    const legacyDataSecret = resolvePurposeSecret(
      config.get<string>('LEGACY_DATA_ENCRYPTION_SECRET'),
      '',
      nodeEnvironment,
      appEnvironment,
      'LEGACY_DATA_ENCRYPTION_SECRET',
      false,
    );

    const encryptionSecret = resolvePurposeSecret(
      config.get<string>('MFA_SECRET_ENCRYPTION_KEY'),
      jwtSecret,
      nodeEnvironment,
      appEnvironment,
      'MFA_SECRET_ENCRYPTION_KEY',
    );
    const previousEncryptionSecret = resolvePurposeSecret(
      config.get<string>('MFA_SECRET_ENCRYPTION_KEY_PREVIOUS'),
      '',
      nodeEnvironment,
      appEnvironment,
      'MFA_SECRET_ENCRYPTION_KEY_PREVIOUS',
      false,
    );
    this.encryptionKeys = createPurposeKeyring(
      encryptionSecret,
      previousEncryptionSecret,
      [legacyDataSecret, jwtSecret, jwtPreviousSecret],
      'fodip-mfa-secret-encryption-v1',
    );

    const challengeSecret = resolvePurposeSecret(
      config.get<string>('MFA_CHALLENGE_SECRET'),
      jwtSecret,
      nodeEnvironment,
      appEnvironment,
      'MFA_CHALLENGE_SECRET',
    );
    const previousChallengeSecret = resolvePurposeSecret(
      config.get<string>('MFA_CHALLENGE_SECRET_PREVIOUS'),
      '',
      nodeEnvironment,
      appEnvironment,
      'MFA_CHALLENGE_SECRET_PREVIOUS',
      false,
    );
    this.challengeKeys = createPurposeKeyring(
      challengeSecret,
      previousChallengeSecret,
      [jwtSecret, jwtPreviousSecret],
      'fodip-mfa-challenge-v1',
    );
  }

  async beginChallenge(user: AuthUserRecord): Promise<MfaSetupChallenge | MfaLoginChallenge> {
    if (!user.mfaConfirmedAt) {
      const secret = user.mfaSecretEncrypted
        ? decryptVersionedWithKeyring(user.mfaSecretEncrypted, this.encryptionKeys)
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

    const secret = decryptVersionedWithKeyring(user.mfaSecretEncrypted, this.encryptionKeys);
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

    const secret = decryptVersionedWithKeyring(user.mfaSecretEncrypted, this.encryptionKeys);
    await this.assertValidCodeAndConsume(user.id, user.email, secret, code);
    return this.sessions.issue(user);
  }

  private async enrollNewSecret(userId: string): Promise<string> {
    const secret = new OTPAuth.Secret({ size: 20 }).base32;
    await this.users.setPendingMfaSecret(userId, encryptVersionedWithKeyring(secret, this.encryptionKeys));
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
      secret: this.challengeKeys.currentKey,
      expiresIn: CHALLENGE_TTL_SECONDS,
      audience: CHALLENGE_AUDIENCE,
      issuer: TOTP_ISSUER,
    });
  }

  private async resolveChallenge(token: string, purpose: MfaChallengePurpose): Promise<string> {
    for (const secret of Object.values(this.challengeKeys.keys)) {
      try {
        const payload = await this.jwtService.verifyAsync<MfaChallengePayload>(token, {
          secret,
          audience: CHALLENGE_AUDIENCE,
          issuer: TOTP_ISSUER,
        });
        if (payload.purpose === purpose) return payload.sub;
      } catch {
        // Continue with the explicitly configured previous/legacy verification key.
      }
    }
    throw new UnauthorizedException('Invalid or expired verification session');
  }
}
