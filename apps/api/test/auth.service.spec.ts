import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { AuthService } from '../src/auth/auth.service';
import { AuthUserRecord } from '../src/users/users.repository';

const baseUser: AuthUserRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'user@fodip.local',
  nom: 'Test',
  prenom: null,
  passwordHash: null,
  actif: true,
  mfaRequired: false,
  mfaSecretEncrypted: null,
  mfaConfirmedAt: null,
  entrepriseId: null,
  roles: ['AGENT_FODIP'],
  permissions: [],
};

async function makeService(user: AuthUserRecord | null) {
  const users = { findForAuthentication: jest.fn().mockResolvedValue(user) };
  const mfa = { beginChallenge: jest.fn().mockResolvedValue({ mfaRequired: true, mfaChallenge: 'challenge' }) };
  const sessions = { issue: jest.fn().mockResolvedValue({ tokenType: 'Bearer', accessToken: 'token' }) };
  const service = new AuthService(users as never, mfa as never, sessions as never);
  return { service, users, mfa, sessions };
}

describe('AuthService.login', () => {
  it('rejects an unknown account without touching password comparison', async () => {
    const { service } = await makeService(null);
    await expect(service.login({ email: 'nobody@fodip.local', password: 'whatever' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an inactive account', async () => {
    const passwordHash = await hash('CorrectHorse#123', 12);
    const { service } = await makeService({ ...baseUser, actif: false, passwordHash });
    await expect(service.login({ email: baseUser.email, password: 'CorrectHorse#123' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a wrong password', async () => {
    const passwordHash = await hash('CorrectHorse#123', 12);
    const { service } = await makeService({ ...baseUser, passwordHash });
    await expect(service.login({ email: baseUser.email, password: 'wrong' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a PME account with no enterprise scope', async () => {
    const passwordHash = await hash('CorrectHorse#123', 12);
    const { service } = await makeService({ ...baseUser, passwordHash, roles: ['PME'], entrepriseId: null });
    await expect(service.login({ email: baseUser.email, password: 'CorrectHorse#123' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('issues a session directly when MFA is not required', async () => {
    const passwordHash = await hash('CorrectHorse#123', 12);
    const { service, sessions, mfa } = await makeService({ ...baseUser, passwordHash });
    const result = await service.login({ email: baseUser.email, password: 'CorrectHorse#123' });

    expect(sessions.issue).toHaveBeenCalledTimes(1);
    expect(mfa.beginChallenge).not.toHaveBeenCalled();
    expect(result).toEqual({ tokenType: 'Bearer', accessToken: 'token' });
  });

  it('delegates to the MFA challenge instead of issuing a session when MFA is required', async () => {
    const passwordHash = await hash('CorrectHorse#123', 12);
    const { service, sessions, mfa } = await makeService({ ...baseUser, passwordHash, mfaRequired: true });
    const result = await service.login({ email: baseUser.email, password: 'CorrectHorse#123' });

    expect(mfa.beginChallenge).toHaveBeenCalledTimes(1);
    expect(sessions.issue).not.toHaveBeenCalled();
    expect(result).toEqual({ mfaRequired: true, mfaChallenge: 'challenge' });
  });
});
