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

describe('JwtAuthGuard', () => {
  it('lets a @Public() route through without even looking for a bearer token', async () => {
    const { context, reflector } = contextFor(undefined, true);
    const jwtService = { verifyAsync: jest.fn() };
    const revocation = { isRevoked: jest.fn() };
    const guard = new JwtAuthGuard(reflector as never, jwtService as never, revocation as never);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects a request with no bearer token', async () => {
    const { context, reflector } = contextFor(undefined);
    const jwtService = { verifyAsync: jest.fn() };
    const revocation = { isRevoked: jest.fn() };
    const guard = new JwtAuthGuard(reflector as never, jwtService as never, revocation as never);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token that fails signature/expiry verification', async () => {
    const { context, reflector } = contextFor('Bearer bad-token');
    const jwtService = { verifyAsync: jest.fn().mockRejectedValue(new Error('invalid signature')) };
    const revocation = { isRevoked: jest.fn() };
    const guard = new JwtAuthGuard(reflector as never, jwtService as never, revocation as never);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(revocation.isRevoked).not.toHaveBeenCalled();
  });

  // Axe E4 (session revocation, docs/14-ROADMAP-SAAS-PREMIUM.md).
  it('rejects a signature-valid token whose jti has been revoked (logged out)', async () => {
    const { context, request, reflector } = contextFor('Bearer good-token');
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', jti: 'jti-1' }) };
    const revocation = { isRevoked: jest.fn().mockResolvedValue(true) };
    const guard = new JwtAuthGuard(reflector as never, jwtService as never, revocation as never);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(revocation.isRevoked).toHaveBeenCalledWith('jti-1');
    expect(request.user).toBeUndefined();
  });

  it('accepts a signature-valid, non-revoked token and populates request.user', async () => {
    const { context, request, reflector } = contextFor('Bearer good-token');
    const payload = { sub: 'user-1', jti: 'jti-1', roles: ['AGENT_FODIP'] };
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue(payload) };
    const revocation = { isRevoked: jest.fn().mockResolvedValue(false) };
    const guard = new JwtAuthGuard(reflector as never, jwtService as never, revocation as never);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(payload);
  });

  // Tokens issued before this axis (or built by hand, e.g. in another test) never had a jti -
  // never blocked on revocation grounds alone, since there is nothing to look up.
  it('accepts a token with no jti without ever calling the revocation check', async () => {
    const { context, request, reflector } = contextFor('Bearer good-token');
    const payload = { sub: 'user-1', roles: ['AGENT_FODIP'] };
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue(payload) };
    const revocation = { isRevoked: jest.fn() };
    const guard = new JwtAuthGuard(reflector as never, jwtService as never, revocation as never);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(revocation.isRevoked).not.toHaveBeenCalled();
    expect(request.user).toEqual(payload);
  });
});
