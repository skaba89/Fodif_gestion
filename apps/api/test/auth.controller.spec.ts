import { AuthController } from '../src/auth/auth.controller';

// Axe E4 (session revocation, docs/14-ROADMAP-SAAS-PREMIUM.md).
describe('AuthController.logout', () => {
  it('revokes the presented token using the jti/sub/exp JwtAuthGuard already put on the request', async () => {
    const revocation = { revoke: jest.fn().mockResolvedValue(undefined) };
    const controller = new AuthController({} as never, revocation as never);
    const request = { user: { sub: 'user-1', jti: 'jti-1', exp: 1_800_000_000, email: 'a@fodip.local', roles: [], permissions: [] } };

    await controller.logout(request as never);

    expect(revocation.revoke).toHaveBeenCalledWith('jti-1', 'user-1', 1_800_000_000);
  });

  it('is a harmless no-op for a token with no jti (issued before this axis)', async () => {
    const revocation = { revoke: jest.fn() };
    const controller = new AuthController({} as never, revocation as never);
    const request = { user: { sub: 'user-1', email: 'a@fodip.local', roles: [], permissions: [] } };

    await controller.logout(request as never);

    expect(revocation.revoke).not.toHaveBeenCalled();
  });
});
