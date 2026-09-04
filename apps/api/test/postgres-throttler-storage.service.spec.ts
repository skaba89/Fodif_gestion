import { PostgresThrottlerStorageService } from '../src/common/postgres-throttler-storage.service';

// Axe E4 (docs/14-ROADMAP-SAAS-PREMIUM.md) - rate limiting distribué. A fake client/transaction
// (no real PostgreSQL) exercising the branching logic in isolation - the real distributed
// guarantee (state actually shared and safe under concurrency) is proven separately against a
// real database in test/integration/postgres-throttler-storage.integration-spec.ts.
function fakeDb(initialRow: { totalHits: number; expiresAt: Date; isBlocked: boolean; blockExpiresAt: Date | null } | null) {
  let row = initialRow;
  const upserts: unknown[][] = [];
  const client = {
    query: jest.fn(async (sql: string, values: unknown[]) => {
      if (sql.includes('DO NOTHING')) {
        // Mirrors the real "ensure a row exists before locking it" insert: only creates the
        // zeroed placeholder when there wasn't a row already, exactly like ON CONFLICT DO NOTHING.
        if (!row) row = { totalHits: 0, expiresAt: new Date(), isBlocked: false, blockExpiresAt: null };
        return { rows: [] };
      }
      if (sql.includes('SELECT')) {
        return { rows: row ? [row] : [] };
      }
      // The final INSERT ... ON CONFLICT DO UPDATE - record what was written and update the fake
      // row so a second increment() call in the same test sees the persisted state.
      upserts.push(values);
      const [, , totalHits, expiresAt, isBlocked, blockExpiresAt] = values as [string, string, number, Date, boolean, Date | null];
      row = { totalHits, expiresAt, isBlocked, blockExpiresAt };
      return { rows: [] };
    }),
  };
  const db = { transaction: jest.fn((work: (client: unknown) => unknown) => work(client)) };
  return { db, upserts, getRow: () => row };
}

describe('PostgresThrottlerStorageService', () => {
  it('counts the first request for a new key as totalHits 1, not blocked', async () => {
    const { db } = fakeDb(null);
    const storage = new PostgresThrottlerStorageService(db as never);

    const record = await storage.increment('login:pme@fodip.test', 60_000, 3, 300_000, 'default');

    expect(record.totalHits).toBe(1);
    expect(record.isBlocked).toBe(false);
    expect(record.timeToExpire).toBeGreaterThan(0);
  });

  it('blocks once totalHits exceeds the limit, and reports the block duration', async () => {
    const now = Date.now();
    const { db } = fakeDb({ totalHits: 3, expiresAt: new Date(now + 30_000), isBlocked: false, blockExpiresAt: null });
    const storage = new PostgresThrottlerStorageService(db as never);

    const record = await storage.increment('login:pme@fodip.test', 60_000, 3, 300_000, 'default');

    expect(record.totalHits).toBe(4);
    expect(record.isBlocked).toBe(true);
    expect(record.timeToBlockExpire).toBeGreaterThan(0);
  });

  it('does not accumulate further hits while already blocked and the block has not lapsed', async () => {
    const now = Date.now();
    const { db, upserts } = fakeDb({
      totalHits: 10, expiresAt: new Date(now + 30_000), isBlocked: true, blockExpiresAt: new Date(now + 200_000),
    });
    const storage = new PostgresThrottlerStorageService(db as never);

    const record = await storage.increment('login:pme@fodip.test', 60_000, 3, 300_000, 'default');

    expect(record.totalHits).toBe(10);
    expect(record.isBlocked).toBe(true);
    // Still persists (so the row's updated_at stays fresh), but with the same, unincremented count.
    expect(upserts[0][2]).toBe(10);
  });

  it('starts a fresh window once the block has lapsed, rather than piling onto the stale over-limit count', async () => {
    const now = Date.now();
    const { db } = fakeDb({
      totalHits: 10, expiresAt: new Date(now + 30_000), isBlocked: true, blockExpiresAt: new Date(now - 1_000),
    });
    const storage = new PostgresThrottlerStorageService(db as never);

    const record = await storage.increment('login:pme@fodip.test', 60_000, 3, 300_000, 'default');

    expect(record.totalHits).toBe(1);
    expect(record.isBlocked).toBe(false);
  });

  it('resets the window once it has naturally expired without ever being blocked', async () => {
    const now = Date.now();
    const { db } = fakeDb({ totalHits: 2, expiresAt: new Date(now - 1_000), isBlocked: false, blockExpiresAt: null });
    const storage = new PostgresThrottlerStorageService(db as never);

    const record = await storage.increment('login:pme@fodip.test', 60_000, 3, 300_000, 'default');

    expect(record.totalHits).toBe(1);
    expect(record.isBlocked).toBe(false);
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
    const now = Date.now();
    const rowA = { totalHits: 3, expiresAt: new Date(now + 30_000), isBlocked: false, blockExpiresAt: null };
    const dbA = fakeDb(rowA).db;
    const dbB = fakeDb(null).db;
    const storageA = new PostgresThrottlerStorageService(dbA as never);
    const storageB = new PostgresThrottlerStorageService(dbB as never);

    const recordA = await storageA.increment('login:pme@fodip.test', 60_000, 3, 300_000, 'default');
    const recordB = await storageB.increment('login:other@fodip.test', 60_000, 3, 300_000, 'default');

    expect(recordA.isBlocked).toBe(true);
    expect(recordB.isBlocked).toBe(false);
  });
});
