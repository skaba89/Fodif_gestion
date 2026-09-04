import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';

function contextFor(authorization?: string, isPublic = false) {
  const request: { headers: Record<string, string | undefined>; user?: unknown } = {
    headers: authorization ? { authorization } : {},
  };
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(isPublic) };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request, reflector };
}

// Axe E4 (key rotation, docs/14-ROADMAP-SAAS-PREMIUM.md) - every test below constructs its own
// jwtService.decode() (the guard reads the token's `kid` from it before verifying) and its own
// jwtKeys resolver, matching JwtKeyResolverService's real contract: falls back to the current
// secret when there is no kid or resolveVerificationSecret isn't stubbed to do otherwise.
function defaultJwtKeys() {
  return { resolveVerificationSecret: jest.fn().mockReturnValue('current-secret') };
}

describe('JwtAuthGuard', () => {
  it('lets a @Public() route through without even looking for a bearer token', async () => {
    const { context, reflector } = contextFor(undefined, true);
    const jwtService = { verifyAsync: jest.fn(), decode: jest.fn() };
    const revocation = { isRevoked: jest.fn() };
    const guard = new JwtAuthGuard(reflector as never, jwtService as never, revocation as never, defaultJwtKeys() as never);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects a request with no bearer token', async () => {
    const { context, reflector } = contextFor(undefined);
    const jwtService = { verifyAsync: jest.fn(), decode: jest.fn() };
    const revocation = { isRevoked: jest.fn() };
    const guard = new JwtAuthGuard(reflector as never, jwtService as never, revocation as never, defaultJwtKeys() as never);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token that fails signature/expiry verification', async () => {
    const { context, reflector } = contextFor('Bearer bad-token');
    const jwtService = { verifyAsync: jest.fn().mockRejectedValue(new Error('invalid signature')), decode: jest.fn() };
    const revocation = { isRevoked: jest.fn() };
    const guard = new JwtAuthGuard(reflector as never, jwtService as never, revocation as never, defaultJwtKeys() as never);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(revocation.isRevoked).not.toHaveBeenCalled();
  });

  // Axe E4 (session revocation, docs/14-ROADMAP-SAAS-PREMIUM.md).
  it('rejects a signature-valid token whose jti has been revoked (logged out)', async () => {
    const { context, request, reflector } = contextFor('Bearer good-token');
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', jti: 'jti-1' }), decode: jest.fn() };
    const revocation = { isRevoked: jest.fn().mockResolvedValue(true) };
    const guard = new JwtAuthGuard(reflector as never, jwtService as never, revocation as never, defaultJwtKeys() as never);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(revocation.isRevoked).toHaveBeenCalledWith('jti-1');
    expect(request.user).toBeUndefined();
  });

  it('accepts a signature-valid, non-revoked token and populates request.user', async () => {
    const { context, request, reflector } = contextFor('Bearer good-token');
    const payload = { sub: 'user-1', jti: 'jti-1', roles: ['AGENT_FODIP'] };
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue(payload), decode: jest.fn() };
    const revocation = { isRevoked: jest.fn().mockResolvedValue(false) };
    const guard = new JwtAuthGuard(reflector as never, jwtService as never, revocation as never, defaultJwtKeys() as never);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(payload);
  });

  // Tokens issued before this axis (or built by hand, e.g. in another test) never had a jti -
  // never blocked on revocation grounds alone, since there is nothing to look up.
  it('accepts a token with no jti without ever calling the revocation check', async () => {
    const { context, request, reflector } = contextFor('Bearer good-token');
    const payload = { sub: 'user-1', roles: ['AGENT_FODIP'] };
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue(payload), decode: jest.fn() };
    const revocation = { isRevoked: jest.fn() };
    const guard = new JwtAuthGuard(reflector as never, jwtService as never, revocation as never, defaultJwtKeys() as never);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(revocation.isRevoked).not.toHaveBeenCalled();
    expect(request.user).toEqual(payload);
  });

  // Axe E4 (key rotation, docs/14-ROADMAP-SAAS-PREMIUM.md).
  describe('key rotation', () => {
    it("reads the token's kid from its header and verifies against the secret that kid resolves to, not always the current one", async () => {
      const { context, request, reflector } = contextFor('Bearer old-key-token');
      const payload = { sub: 'user-1', roles: ['PME'] };
      const jwtService = {
        decode: jest.fn().mockReturnValue({ header: { kid: 'abcd1234' }, payload }),
        verifyAsync: jest.fn().mockResolvedValue(payload),
      };
      const jwtKeys = { resolveVerificationSecret: jest.fn().mockReturnValue('previous-secret-value') };
      const revocation = { isRevoked: jest.fn().mockResolvedValue(false) };
      const guard = new JwtAuthGuard(reflector as never, jwtService as never, revocation as never, jwtKeys as never);

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(jwtKeys.resolveVerificationSecret).toHaveBeenCalledWith('abcd1234');
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('old-key-token', { secret: 'previous-secret-value' });
      expect(request.user).toEqual(payload);
    });

    it('falls back to the current secret for a token with no kid (issued before this axis) rather than rejecting it outright', async () => {
      const { context, reflector } = contextFor('Bearer legacy-token');
      const payload = { sub: 'user-1', roles: ['PME'] };
      const jwtService = {
        decode: jest.fn().mockReturnValue({ header: {}, payload }),
        verifyAsync: jest.fn().mockResolvedValue(payload),
      };
      const jwtKeys = { resolveVerificationSecret: jest.fn().mockReturnValue('current-secret') };
      const revocation = { isRevoked: jest.fn().mockResolvedValue(false) };
      const guard = new JwtAuthGuard(reflector as never, jwtService as never, revocation as never, jwtKeys as never);

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(jwtKeys.resolveVerificationSecret).toHaveBeenCalledWith(undefined);
    });

    it('a malformed token that fails to decode is still rejected as unauthorized, not thrown as a 500', async () => {
      const { context, reflector } = contextFor('Bearer not-even-a-jwt');
      const jwtService = { decode: jest.fn().mockReturnValue(null), verifyAsync: jest.fn().mockRejectedValue(new Error('jwt malformed')) };
      const revocation = { isRevoked: jest.fn() };
      const guard = new JwtAuthGuard(reflector as never, jwtService as never, revocation as never, defaultJwtKeys() as never);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
