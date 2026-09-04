import { PostgresThrottlerStorageService } from '../src/common/postgres-throttler-storage.service';

// Axe E4 (docs/14-ROADMAP-SAAS-PREMIUM.md) - rate limiting distribué. A fake two-table
// database (no real PostgreSQL) exercising the branching logic in isolation - the real
// distributed guarantee (state actually shared and safe under concurrency) is proven separately
// against a real database in test/integration/postgres-throttler-storage.integration-spec.ts.
function fakeDb() {
  const hits: { key: string; throttlerName: string; expiresAt: number }[] = [];
  const blocks = new Map<string, number>();
  const composite = (key: string, throttlerName: string) => `${key}::${throttlerName}`;

  const client = {
    query: jest.fn(async (sql: string, values: unknown[] = []) => {
      const now = Date.now();
      if (sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [] };

      if (sql.includes('FROM rate_limit_blocks') && sql.startsWith('SELECT')) {
        const [key, throttlerName] = values as [string, string];
        const blockExpiresAt = blocks.get(composite(key, throttlerName));
        return { rows: blockExpiresAt ? [{ blockExpiresAt: new Date(blockExpiresAt) }] : [] };
      }
      if (sql.startsWith('DELETE FROM rate_limit_blocks')) {
        const [key, throttlerName] = values as [string, string];
        blocks.delete(composite(key, throttlerName));
        return { rows: [] };
      }
      if (sql.startsWith('DELETE FROM rate_limit_hits')) {
        const [key, throttlerName] = values as [string, string];
        const expiredOnly = sql.includes('expires_at <= NOW()');
        for (let i = hits.length - 1; i >= 0; i -= 1) {
          const matches = hits[i].key === key && hits[i].throttlerName === throttlerName;
          if (matches && (!expiredOnly || hits[i].expiresAt <= now)) hits.splice(i, 1);
        }
        return { rows: [] };
      }
      if (sql.startsWith('INSERT INTO rate_limit_hits')) {
        const [key, throttlerName, expiresAt] = values as [string, string, Date];
        hits.push({ key, throttlerName, expiresAt: expiresAt.getTime() });
        return { rows: [] };
      }
      if (sql.includes('SELECT COUNT(*)') && sql.includes('FROM rate_limit_hits')) {
        const [key, throttlerName] = values as [string, string];
        const filterActive = sql.includes('expires_at > NOW()');
        const matching = hits.filter((h) => h.key === key && h.throttlerName === throttlerName && (!filterActive || h.expiresAt > now));
        const oldest = matching.length ? Math.min(...matching.map((h) => h.expiresAt)) : null;
        return { rows: [{ totalHits: String(matching.length), oldestExpiresAt: oldest ? new Date(oldest) : null }] };
      }
      if (sql.startsWith('INSERT INTO rate_limit_blocks')) {
        const [key, throttlerName, blockExpiresAt] = values as [string, string, Date];
        blocks.set(composite(key, throttlerName), blockExpiresAt.getTime());
        return { rows: [] };
      }
      throw new Error(`Unhandled fake query: ${sql}`);
    }),
  };
  const db = { transaction: jest.fn((work: (client: unknown) => unknown) => work(client)) };
  return { db, hits, blocks };
}

describe('PostgresThrottlerStorageService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1_700_000_000_000);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('counts the first request for a new key as totalHits 1, not blocked', async () => {
    const { db } = fakeDb();
    const storage = new PostgresThrottlerStorageService(db as never);

    const record = await storage.increment('login:pme@fodip.test', 60_000, 3, 300_000, 'default');

    expect(record.totalHits).toBe(1);
    expect(record.isBlocked).toBe(false);
    expect(record.timeToExpire).toBe(60);
  });

  it('blocks once totalHits exceeds the limit, and reports the block duration', async () => {
    const { db } = fakeDb();
    const storage = new PostgresThrottlerStorageService(db as never);

    for (let i = 0; i < 3; i += 1) await storage.increment('login:pme@fodip.test', 60_000, 3, 300_000, 'default');
    const record = await storage.increment('login:pme@fodip.test', 60_000, 3, 300_000, 'default');

    expect(record.totalHits).toBe(4);
    expect(record.isBlocked).toBe(true);
    expect(record.timeToBlockExpire).toBe(300);
  });

  it('does not accumulate further hits while already blocked and the block has not lapsed', async () => {
    const { db, hits } = fakeDb();
    const storage = new PostgresThrottlerStorageService(db as never);
    for (let i = 0; i < 4; i += 1) await storage.increment('login:pme@fodip.test', 60_000, 3, 300_000, 'default');
    expect(hits).toHaveLength(4); // the 4th hit is what tripped the block

    const record = await storage.increment('login:pme@fodip.test', 60_000, 3, 300_000, 'default');

    expect(record.totalHits).toBe(4);
    expect(record.isBlocked).toBe(true);
    expect(hits).toHaveLength(4); // no new hit row added while blocked
  });

  it('is a genuine SLIDING window: widely-spaced hits never accumulate together, unlike a fixed window', async () => {
    // This is the exact scenario a fixed-window implementation got wrong (found by a real CI
    // failure, not by inspection - see the class-level comment): playwright.config.ts's
    // HEAVY_LOGIN_SPECS relies on spread-out logins across a long test run never piling up
    // inside the same window.
    const { db } = fakeDb();
    const storage = new PostgresThrottlerStorageService(db as never);
    const start = Date.now();

    // 5 hits spaced 45s apart - each one individually still ages out (ttl=60s) before all of
    // them would ever coexist, so none should ever see more than 2 concurrent hits.
    const seen: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      jest.setSystemTime(start + i * 45_000);
      const record = await storage.increment('login:admin@fodip.test', 60_000, 5, 300_000, 'default');
      seen.push(record.totalHits);
    }

    expect(seen.every((totalHits) => totalHits <= 2)).toBe(true);
    const lastRecord = await storage.increment('login:admin@fodip.test', 60_000, 5, 300_000, 'default');
    expect(lastRecord.isBlocked).toBe(false);
  });

  it('a hit ages out of the count exactly ttl after it happened', async () => {
    const { db } = fakeDb();
    const storage = new PostgresThrottlerStorageService(db as never);
    const start = Date.now();

    await storage.increment('sliding:key', 60_000, 10, 300_000, 'default');
    jest.setSystemTime(start + 30_000);
    const midway = await storage.increment('sliding:key', 60_000, 10, 300_000, 'default');
    expect(midway.totalHits).toBe(2); // first hit still active (30s < 60s ttl)

    jest.setSystemTime(start + 61_000);
    const afterFirstExpired = await storage.increment('sliding:key', 60_000, 10, 300_000, 'default');
    // The first hit (at t=0) aged out at t=60s; the second (at t=30s) is still active (31s old).
    expect(afterFirstExpired.totalHits).toBe(2);
  });

  it('starts counting again once a block has lapsed, rather than staying blocked forever', async () => {
    const { db } = fakeDb();
    const storage = new PostgresThrottlerStorageService(db as never);
    const start = Date.now();
    for (let i = 0; i < 2; i += 1) await storage.increment('short-block', 60_000, 1, 50, 'default');
    const blocked = await storage.increment('short-block', 60_000, 1, 50, 'default');
    expect(blocked.isBlocked).toBe(true);

    jest.setSystemTime(start + 200); // outlast the 50ms blockDuration

    const afterBlock = await storage.increment('short-block', 60_000, 1, 50, 'default');
    expect(afterBlock.isBlocked).toBe(false);
  });

  it('fails open (allows the request) rather than 500ing every route when the database is unavailable', async () => {
    // ThrottlerGuard is a global APP_GUARD - every request on every route calls increment()
    // before it does anything else, so an unreachable database here must never take the whole
    // API down (see the class-level comment for why this differs from a fail-closed control).
    const db = { transaction: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) };
    const storage = new PostgresThrottlerStorageService(db as never);

    const record = await storage.increment('login:pme@fodip.test', 60_000, 3, 300_000, 'default');

    expect(record).toEqual({ totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 });
  });

  it('keeps two different keys on completely independent counters', async () => {
    const { db } = fakeDb();
    const storage = new PostgresThrottlerStorageService(db as never);
    for (let i = 0; i < 4; i += 1) await storage.increment('login:pme@fodip.test', 60_000, 3, 300_000, 'default');

    const recordA = await storage.increment('login:pme@fodip.test', 60_000, 3, 300_000, 'default');
    const recordB = await storage.increment('login:other@fodip.test', 60_000, 3, 300_000, 'default');

    expect(recordA.isBlocked).toBe(true);
    expect(recordB.isBlocked).toBe(false);
  });
});
