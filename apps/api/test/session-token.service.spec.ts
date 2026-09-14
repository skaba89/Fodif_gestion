import { SessionTokenService } from '../src/auth/session-token.service';
import { AuthUserRecord } from '../src/users/users.repository';

const user: AuthUserRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'agent@fodip.local',
  nom: 'Agent',
  prenom: null,
  passwordHash: 'irrelevant',
  actif: true,
  sessionVersion: 7,
  mfaRequired: false,
  mfaSecretEncrypted: null,
  mfaConfirmedAt: null,
  entrepriseId: null,
  partenaireBancaireId: null,
  roles: ['AGENT_FODIP'],
  permissions: ['APPLICATION_READ'],
};

describe('SessionTokenService', () => {
  it('binds the token to the current account session version', async () => {
    const config = { get: jest.fn().mockReturnValue('15m') };
    const users = { updateLastLogin: jest.fn().mockResolvedValue(undefined) };
    const jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    const service = new SessionTokenService(config as never, users as never, jwtService as never);

    await expect(service.issue(user)).resolves.toMatchObject({
      accessToken: 'signed-token',
      expiresIn: '15m',
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith(expect.objectContaining({
      sub: user.id,
      sessionVersion: 7,
      roles: ['AGENT_FODIP'],
    }));
    expect(users.updateLastLogin).toHaveBeenCalledWith(user.id);
  });
});
