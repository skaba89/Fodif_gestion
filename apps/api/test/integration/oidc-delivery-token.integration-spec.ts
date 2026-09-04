/**
 * Real-PostgreSQL coverage for axe E4 (durcissement OIDC, docs/14-ROADMAP-SAAS-PREMIUM.md).
 * `test/oidc.service.spec.ts` already covers the branching logic (issue/resolve, replay
 * rejection) against a fake in-memory claim store; what only a real database can prove is the
 * actual point of this axis - that two concurrent redemptions of the same delivery token (the
 * realistic threat: an attacker who obtained a copy from browser history/access logs racing the
 * real user, or simply double-clicking) can never both succeed, enforced by a real UNIQUE
 * constraint under real concurrency, not just first-writer-wins in a single-threaded mock.
 *
 * Only `issueDeliveryToken`/`resolveDeliveryToken` are exercised here - they need no OIDC
 * discovery/IdP at all (unlike beginAuthorization/completeAuthorization), so a real
 * DatabaseService is all this needs beyond the same fake ConfigService values every other OidcService
 * test uses.
 */
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { OidcService } from '../../src/auth/oidc/oidc.service';
import { IntegrationDatabase, startIntegrationDatabase } from './support/database';

const ENV: Record<string, string> = {
  JWT_SECRET: 'x'.repeat(40),
  NODE_ENV: 'test',
  OIDC_ISSUER_URL: 'https://idp.example.org/realms/fodip',
  OIDC_CLIENT_ID: 'fodip-web',
  OIDC_CLIENT_SECRET: 'client-secret-value',
  OIDC_REDIRECT_URI: 'https://api.example.org/api/v1/auth/oidc/callback',
};

describe('OidcService delivery token replay protection (real PostgreSQL)', () => {
  let integrationDb: IntegrationDatabase;
  let service: OidcService;

  beforeAll(async () => {
    integrationDb = await startIntegrationDatabase();
    const config = { get: (key: string) => ENV[key] } as ConfigService;
    service = new OidcService(config, new JwtService(), integrationDb.db);
  }, 120_000);

  afterAll(async () => {
    await integrationDb.stop();
  });

  beforeEach(async () => {
    await integrationDb.reset();
  });

  it('resolves a fresh delivery token to its user id, and persists a real claim row', async () => {
    const token = await service.issueDeliveryToken('user-1');

    await expect(service.resolveDeliveryToken(token)).resolves.toBe('user-1');

    const rows = await integrationDb.pool.query('SELECT jti FROM oidc_delivery_tokens_used');
    expect(rows.rows).toHaveLength(1);
  });

  it('rejects a second exchange of the same token against a real UNIQUE constraint', async () => {
    const token = await service.issueDeliveryToken('user-1');

    await expect(service.resolveDeliveryToken(token)).resolves.toBe('user-1');
    await expect(service.resolveDeliveryToken(token)).rejects.toBeInstanceOf(UnauthorizedException);

    const rows = await integrationDb.pool.query('SELECT jti FROM oidc_delivery_tokens_used');
    expect(rows.rows).toHaveLength(1); // still exactly one claim row, not two
  });

  it("never lets two concurrent redemptions of the same token both succeed - the actual threat this axis closes", async () => {
    const token = await service.issueDeliveryToken('user-1');

    const results = await Promise.allSettled([
      service.resolveDeliveryToken(token),
      service.resolveDeliveryToken(token),
      service.resolveDeliveryToken(token),
    ]);

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(2);

    const rows = await integrationDb.pool.query('SELECT jti FROM oidc_delivery_tokens_used');
    expect(rows.rows).toHaveLength(1);
  });

  it('lets two different delivery tokens each be redeemed once, independently', async () => {
    const tokenA = await service.issueDeliveryToken('user-1');
    const tokenB = await service.issueDeliveryToken('user-2');

    await expect(service.resolveDeliveryToken(tokenA)).resolves.toBe('user-1');
    await expect(service.resolveDeliveryToken(tokenB)).resolves.toBe('user-2');
    await expect(service.resolveDeliveryToken(tokenA)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
