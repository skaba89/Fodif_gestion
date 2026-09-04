import { RevocationService } from '../src/common/revocation/revocation.service';

// Axe E4 (session revocation, docs/14-ROADMAP-SAAS-PREMIUM.md). A fake DatabaseService recording
// every query - real Postgres behaviour (the UNIQUE constraint on jti, expires_at filtering) is
// covered against a real database in the integration suite; this level checks RevocationService's
// own logic: which queries it issues, with which values, and in what order.
function fakeDb(rows: unknown[] = []) {
  const queries: Array<{ text: string; values: unknown[] }> = [];
  const db = {
    query: jest.fn(async (text: string, values: unknown[] = []) => {
      queries.push({ text, values });
      return { rows, rowCount: rows.length };
    }),
  };
  return { db, queries };
}

describe('RevocationService', () => {
  it('revoke() records the jti with its own expiry, then opportunistically sweeps expired rows', async () => {
    const { db, queries } = fakeDb();
    const service = new RevocationService(db as never);

    await service.revoke('11111111-1111-4111-8111-111111111111', 'user-1', 1_800_000_000);

    expect(queries).toHaveLength(2);
    expect(queries[0].text).toMatch(/INSERT INTO revoked_tokens/);
    expect(queries[0].text).toMatch(/ON CONFLICT \(jti\) DO NOTHING/);
    expect(queries[0].values).toEqual(['11111111-1111-4111-8111-111111111111', 'user-1', 1_800_000_000]);
    expect(queries[1].text).toMatch(/DELETE FROM revoked_tokens WHERE expires_at < NOW\(\)/);
  });

  it('isRevoked() reports true only when a non-expired row exists for that jti', async () => {
    const { db, queries } = fakeDb([{ '?column?': 1 }]);
    const service = new RevocationService(db as never);

    await expect(service.isRevoked('11111111-1111-4111-8111-111111111111')).resolves.toBe(true);
    expect(queries[0].text).toMatch(/expires_at > NOW\(\)/);
    expect(queries[0].values).toEqual(['11111111-1111-4111-8111-111111111111']);
  });

  it('isRevoked() reports false when no row matches', async () => {
    const { db } = fakeDb([]);
    const service = new RevocationService(db as never);

    await expect(service.isRevoked('22222222-2222-4222-8222-222222222222')).resolves.toBe(false);
  });
});
