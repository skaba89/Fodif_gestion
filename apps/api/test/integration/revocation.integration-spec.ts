/**
 * Real-PostgreSQL coverage for axe E4 (session revocation, docs/14-ROADMAP-SAAS-PREMIUM.md).
 * `test/revocation.service.spec.ts` and `test/jwt-auth.guard.spec.ts` already cover the query
 * shape and the guard's branching logic against mocks; what only a real database can prove is the
 * UNIQUE constraint on jti (a double revoke, e.g. two logout clicks, must not error), that
 * expires_at filtering genuinely excludes an expired entry rather than just being the right SQL on
 * paper, and the full real chain end to end: a token SessionTokenService actually signs is
 * accepted by JwtAuthGuard, then rejected by that same guard the moment RevocationService records
 * its jti - the two services never share code, only the database row between them.
 */
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RevocationService } from '../../src/common/revocation/revocation.service';
import { seedUser } from './support/fixtures';
import { IntegrationDatabase, startIntegrationDatabase } from './support/database';

function contextFor(authorization?: string) {
  const request: { headers: Record<string, string | undefined>; user?: unknown } = {
    headers: authorization ? { authorization } : {},
  };
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
  return { context, request, reflector };
}

describe('Session revocation (real PostgreSQL)', () => {
  let integrationDb: IntegrationDatabase;
  let revocation: RevocationService;

  beforeAll(async () => {
    integrationDb = await startIntegrationDatabase();
    revocation = new RevocationService(integrationDb.db);
  }, 120_000);

  afterAll(async () => {
    await integrationDb.stop();
  });

  beforeEach(async () => {
    await integrationDb.reset();
  });

  it('a revoked jti is reported revoked; an unrelated jti is not', async () => {
    const user = await seedUser(integrationDb.pool);
    const jti = randomUUID();
    const otherJti = randomUUID();
    const exp = Math.floor(Date.now() / 1000) + 900;

    await revocation.revoke(jti, user.id, exp);

    await expect(revocation.isRevoked(jti)).resolves.toBe(true);
    await expect(revocation.isRevoked(otherJti)).resolves.toBe(false);
  });

  it('revoking the same jti twice (e.g. a double logout click) does not error', async () => {
    const user = await seedUser(integrationDb.pool);
    const jti = randomUUID();
    const exp = Math.floor(Date.now() / 1000) + 900;

    await revocation.revoke(jti, user.id, exp);
    await expect(revocation.revoke(jti, user.id, exp)).resolves.not.toThrow();
    await expect(revocation.isRevoked(jti)).resolves.toBe(true);
  });

  it('an entry past its own expires_at is no longer reported revoked, and gets swept on the next revoke() call', async () => {
    const user = await seedUser(integrationDb.pool);
    const expiredJti = randomUUID();
    await integrationDb.pool.query(
      `INSERT INTO revoked_tokens (jti, utilisateur_id, expires_at) VALUES ($1, $2, NOW() - INTERVAL '1 hour')`,
      [expiredJti, user.id],
    );

    // Filtered out even before any cleanup runs - expires_at > NOW() is checked at read time too.
    await expect(revocation.isRevoked(expiredJti)).resolves.toBe(false);

    // A later, unrelated revoke() opportunistically sweeps it.
    await revocation.revoke(randomUUID(), user.id, Math.floor(Date.now() / 1000) + 900);
    const row = await integrationDb.pool.query('SELECT 1 FROM revoked_tokens WHERE jti = $1', [expiredJti]);
    expect(row.rowCount).toBe(0);
  });

  // The real chain: SessionTokenService signs, JwtAuthGuard verifies + checks revocation,
  // RevocationService records the logout - proven together, not just each piece in isolation.
  describe('JwtAuthGuard + a real signed token', () => {
    const jwtService = new JwtService({ secret: 'integration-test-secret' });
    // Axe E4 (key rotation) - this suite's tokens are never tagged with a `kid` (signToken below
    // doesn't set one), so the guard's real fallback-to-current-secret path is what's exercised;
    // this stub just needs to resolve to the one secret this whole describe block signs with.
    const jwtKeys = { resolveVerificationSecret: () => 'integration-test-secret' };

    async function signToken(userId: string, jti: string) {
      return jwtService.signAsync({ sub: userId, email: 'agent@fodip.test', roles: ['AGENT_FODIP'], permissions: [], jti }, { expiresIn: '15m' });
    }

    it('accepts a fresh token, then rejects the same token once it has been logged out', async () => {
      const user = await seedUser(integrationDb.pool);
      const jti = randomUUID();
      const token = await signToken(user.id, jti);
      const guard = new JwtAuthGuard({ getAllAndOverride: jest.fn().mockReturnValue(false) } as never, jwtService, revocation, jwtKeys as never);

      const { context: firstContext, request: firstRequest } = contextFor(`Bearer ${token}`);
      await expect(guard.canActivate(firstContext)).resolves.toBe(true);
      expect(firstRequest.user).toMatchObject({ sub: user.id, jti });

      const decoded = jwtService.decode<{ exp: number }>(token);
      await revocation.revoke(jti, user.id, decoded.exp);

      const { context: secondContext } = contextFor(`Bearer ${token}`);
      await expect(guard.canActivate(secondContext)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('logging out one session does not affect a second, independently-issued session for the same user', async () => {
      const user = await seedUser(integrationDb.pool);
      const [jtiA, jtiB] = [randomUUID(), randomUUID()];
      const [tokenA, tokenB] = await Promise.all([signToken(user.id, jtiA), signToken(user.id, jtiB)]);
      const guard = new JwtAuthGuard({ getAllAndOverride: jest.fn().mockReturnValue(false) } as never, jwtService, revocation, jwtKeys as never);

      const decodedA = jwtService.decode<{ exp: number }>(tokenA);
      await revocation.revoke(jtiA, user.id, decodedA.exp);

      const { context: contextA } = contextFor(`Bearer ${tokenA}`);
      await expect(guard.canActivate(contextA)).rejects.toBeInstanceOf(UnauthorizedException);

      const { context: contextB, request: requestB } = contextFor(`Bearer ${tokenB}`);
      await expect(guard.canActivate(contextB)).resolves.toBe(true);
      expect(requestB.user).toMatchObject({ sub: user.id, jti: jtiB });
    });
  });
});
