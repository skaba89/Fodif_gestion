/**
 * Real-PostgreSQL coverage for axe E4 (rate limiting distribué, docs/14-ROADMAP-SAAS-PREMIUM.md).
 * `test/postgres-throttler-storage.service.spec.ts` already covers the branching logic against a
 * fake client; what only a real database can prove is the actual point of this axis - that state
 * is genuinely shared across separate `PostgresThrottlerStorageService` instances (standing in for
 * separate API processes behind a load balancer, each with its own in-memory nothing to share) and
 * that concurrent increments for the same key are never lost to a lost-update race.
 */
import { PostgresThrottlerStorageService } from '../../src/common/postgres-throttler-storage.service';
import { IntegrationDatabase, startIntegrationDatabase } from './support/database';

describe('PostgresThrottlerStorageService (real PostgreSQL)', () => {
  let integrationDb: IntegrationDatabase;

  beforeAll(async () => {
    integrationDb = await startIntegrationDatabase();
  }, 120_000);

  afterAll(async () => {
    await integrationDb.stop();
  });

  beforeEach(async () => {
    await integrationDb.reset();
  });

  it('shares hit counts across two separate storage instances on the same key - the actual point of this axis', async () => {
    // Two instances, standing in for two API processes behind a load balancer: with the old
    // in-memory storage each would have its own Map and never see the other's hits.
    const instanceA = new PostgresThrottlerStorageService(integrationDb.db);
    const instanceB = new PostgresThrottlerStorageService(integrationDb.db);

    const r1 = await instanceA.increment('login:pme@fodip.test', 60_000, 3, 300_000, 'default');
    const r2 = await instanceB.increment('login:pme@fodip.test', 60_000, 3, 300_000, 'default');
    const r3 = await instanceA.increment('login:pme@fodip.test', 60_000, 3, 300_000, 'default');
    const r4 = await instanceB.increment('login:pme@fodip.test', 60_000, 3, 300_000, 'default');

    expect([r1.totalHits, r2.totalHits, r3.totalHits, r4.totalHits]).toEqual([1, 2, 3, 4]);
    expect(r3.isBlocked).toBe(false);
    expect(r4.isBlocked).toBe(true);
  });

  it('never loses a hit under real concurrent increments for the same key (FOR UPDATE serializes the race)', async () => {
    const storage = new PostgresThrottlerStorageService(integrationDb.db);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => storage.increment('concurrent:key', 60_000, 100, 300_000, 'default')),
    );

    const totals = results.map((r) => r.totalHits).sort((a, b) => a - b);
    expect(totals).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const row = await integrationDb.pool.query(`SELECT total_hits AS "totalHits" FROM rate_limit_hits WHERE key = 'concurrent:key'`);
    expect(row.rows[0].totalHits).toBe(10);
  });

  it('blocks concurrent requests once the limit is exceeded, without ever exceeding it silently', async () => {
    const storage = new PostgresThrottlerStorageService(integrationDb.db);

    const results = await Promise.all(
      Array.from({ length: 8 }, () => storage.increment('concurrent:blocked', 60_000, 5, 300_000, 'default')),
    );

    const blockedCount = results.filter((r) => r.isBlocked).length;
    // Requests 6, 7, 8 (whichever three actually land past the limit) are blocked - exactly the
    // hits beyond the limit of 5, never fewer (a lost update) nor more (a false positive).
    expect(blockedCount).toBe(3);
  });

  it('persists an independent row per (key, throttlerName) pair, real rows in rate_limit_hits', async () => {
    const storage = new PostgresThrottlerStorageService(integrationDb.db);

    await storage.increment('shared-key', 60_000, 3, 300_000, 'default');
    await storage.increment('shared-key', 60_000, 3, 300_000, 'login');

    const rows = await integrationDb.pool.query(
      `SELECT throttler_name AS "throttlerName", total_hits AS "totalHits" FROM rate_limit_hits WHERE key = 'shared-key' ORDER BY throttler_name`,
    );
    expect(rows.rows).toEqual([
      { throttlerName: 'default', totalHits: 1 },
      { throttlerName: 'login', totalHits: 1 },
    ]);
  });

  it('unblocks and starts a fresh window once the block duration has genuinely elapsed', async () => {
    const storage = new PostgresThrottlerStorageService(integrationDb.db);
    await storage.increment('short-block', 60_000, 1, 50, 'default'); // hit 1, under the limit
    const blocked = await storage.increment('short-block', 60_000, 1, 50, 'default'); // hit 2, exceeds limit=1
    expect(blocked.isBlocked).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 120)); // outlast the 50ms blockDuration

    const afterBlock = await storage.increment('short-block', 60_000, 1, 50, 'default');
    expect(afterBlock.isBlocked).toBe(false);
    expect(afterBlock.totalHits).toBe(1);
  });
});
