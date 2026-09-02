import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as OTPAuth from 'otpauth';
import { MfaLoginChallenge, MfaService, MfaSetupChallenge } from '../src/auth/mfa/mfa.service';
import { AuthUserRecord } from '../src/users/users.repository';

function expectSetup(result: MfaSetupChallenge | MfaLoginChallenge): MfaSetupChallenge {
  if (!('mfaSetupRequired' in result)) throw new Error('expected a setup challenge');
  return result;
}

const config = { get: (key: string) => ({ JWT_SECRET: 'x'.repeat(40), NODE_ENV: 'test' }[key]) } as ConfigService;

const baseUser: AuthUserRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@fodip.local',
  nom: 'Admin',
  prenom: null,
  passwordHash: 'irrelevant',
  actif: true,
  mfaRequired: true,
  mfaSecretEncrypted: null,
  mfaConfirmedAt: null,
  entrepriseId: null,
  roles: ['SUPER_ADMIN'],
  permissions: [],
};

function codeFor(secretBase32: string): string {
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secretBase32), digits: 6, period: 30, algorithm: 'SHA1' });
  return totp.generate();
}

function makeService() {
  const users = {
    findAuthenticatedById: jest.fn(),
    setPendingMfaSecret: jest.fn().mockResolvedValue(undefined),
    confirmMfaSecret: jest.fn().mockResolvedValue(undefined),
    consumeMfaStep: jest.fn().mockResolvedValue(true),
  };
  const sessions = { issue: jest.fn().mockResolvedValue({ tokenType: 'Bearer', accessToken: 'final-token' }) };
  const service = new MfaService(config, users as never, new JwtService(), sessions as never);
  return { service, users, sessions };
}

describe('MfaService', () => {
  it('starts enrollment for an account with no TOTP seed yet', async () => {
    const { service, users } = makeService();
    const result = expectSetup(await service.beginChallenge(baseUser));

    expect(result.secret).toMatch(/^[A-Z2-7]+=*$/);
    expect(result.otpauthUrl).toContain('admin%40fodip.local');
    expect(users.setPendingMfaSecret).toHaveBeenCalledTimes(1);
  });

  it('reuses the pending secret instead of regenerating it on a second login attempt', async () => {
    const { service, users } = makeService();
    const first = expectSetup(await service.beginChallenge(baseUser));
    const encrypted = users.setPendingMfaSecret.mock.calls[0][1] as string;

    const pendingUser = { ...baseUser, mfaSecretEncrypted: encrypted };
    const second = expectSetup(await service.beginChallenge(pendingUser));

    expect(second.secret).toBe(first.secret);
    expect(users.setPendingMfaSecret).toHaveBeenCalledTimes(1);
  });

  it('requests a login challenge (not setup) once the seed is confirmed', async () => {
    const { service, users } = makeService();
    const confirmedUser = { ...baseUser, mfaSecretEncrypted: 'irrelevant-because-not-decrypted-here', mfaConfirmedAt: new Date() };
    const result = await service.beginChallenge(confirmedUser);

    expect(result).toEqual({ mfaRequired: true, mfaChallenge: expect.any(String) });
    expect(users.setPendingMfaSecret).not.toHaveBeenCalled();
  });

  it('confirms enrollment with a valid code and completes login', async () => {
    const { service, users, sessions } = makeService();
    const { secret, mfaChallenge } = expectSetup(await service.beginChallenge(baseUser));
    const encrypted = users.setPendingMfaSecret.mock.calls[0][1] as string;
    users.findAuthenticatedById.mockResolvedValue({ ...baseUser, mfaSecretEncrypted: encrypted, mfaConfirmedAt: null });

    const result = await service.confirmEnrollment(mfaChallenge, codeFor(secret));

    expect(users.confirmMfaSecret).toHaveBeenCalledWith(baseUser.id);
    expect(sessions.issue).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ tokenType: 'Bearer', accessToken: 'final-token' });
  });

  it('rejects enrollment confirmation with a wrong code', async () => {
    const { service, users } = makeService();
    const { mfaChallenge } = await service.beginChallenge(baseUser);
    const encrypted = users.setPendingMfaSecret.mock.calls[0][1] as string;
    users.findAuthenticatedById.mockResolvedValue({ ...baseUser, mfaSecretEncrypted: encrypted, mfaConfirmedAt: null });

    await expect(service.confirmEnrollment(mfaChallenge, '000000')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.confirmMfaSecret).not.toHaveBeenCalled();
  });

  it('verifies a login challenge for an already-enrolled account', async () => {
    const { service, users, sessions } = makeService();
    const setup = expectSetup(await service.beginChallenge(baseUser));
    const encrypted = users.setPendingMfaSecret.mock.calls[0][1] as string;

    const enrolledUser = { ...baseUser, mfaSecretEncrypted: encrypted, mfaConfirmedAt: new Date() };
    const { mfaChallenge } = await service.beginChallenge(enrolledUser);
    users.findAuthenticatedById.mockResolvedValue(enrolledUser);

    await service.verifyLogin(mfaChallenge, codeFor(setup.secret));
    expect(sessions.issue).toHaveBeenCalledWith(enrolledUser);
  });

  it('rejects a replayed code even when it is otherwise valid', async () => {
    const { service, users } = makeService();
    const setup = expectSetup(await service.beginChallenge(baseUser));
    const encrypted = users.setPendingMfaSecret.mock.calls[0][1] as string;
    const enrolledUser = { ...baseUser, mfaSecretEncrypted: encrypted, mfaConfirmedAt: new Date() };
    users.findAuthenticatedById.mockResolvedValue(enrolledUser);
    users.consumeMfaStep.mockResolvedValueOnce(false);

    const { mfaChallenge } = await service.beginChallenge(enrolledUser);
    await expect(service.verifyLogin(mfaChallenge, codeFor(setup.secret))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a setup challenge presented to the login-verification endpoint', async () => {
    const { service } = makeService();
    const { mfaChallenge } = await service.beginChallenge(baseUser);

    await expect(service.verifyLogin(mfaChallenge, '123456')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
