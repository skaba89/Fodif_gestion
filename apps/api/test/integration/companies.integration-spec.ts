/**
 * Real-PostgreSQL coverage for axe E5 (verrouillage optimiste, docs/14-ROADMAP-SAAS-PREMIUM.md).
 * `test/companies.service.spec.ts` already covers the branching logic against a mocked
 * repository; what only a real database can prove is the race itself - two "simultaneous" saves
 * of the same stale version, exactly one of which may win - and that a successful save actually
 * advances the version so the next save is protected against the one that just landed, not stuck
 * comparing against a version nobody holds anymore.
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CompaniesRepository } from '../../src/companies/companies.repository';
import { CompaniesService } from '../../src/companies/companies.service';
import { IntegrationDatabase, startIntegrationDatabase } from './support/database';

async function seedCompany(pool: IntegrationDatabase['pool']): Promise<{ id: string }> {
  const unique = randomUUID().slice(0, 8);
  const result = await pool.query<{ id: string }>(
    `INSERT INTO entreprises (code_fodip, raison_sociale, nombre_employes)
     VALUES ($1, 'Kankan Agro Transformation SARL', 12) RETURNING id`,
    [`FODIP-PME-${unique}`],
  );
  return result.rows[0];
}

describe('Company profile optimistic locking (real PostgreSQL)', () => {
  let integrationDb: IntegrationDatabase;
  let repository: CompaniesRepository;
  let service: CompaniesService;
  let user: { sub: string; email: string; roles: string[]; permissions: string[]; entrepriseId: string };

  beforeAll(async () => {
    integrationDb = await startIntegrationDatabase();
    repository = new CompaniesRepository(integrationDb.db);
    service = new CompaniesService(repository);
  }, 120_000);

  afterAll(async () => {
    await integrationDb.stop();
  });

  beforeEach(async () => {
    await integrationDb.reset();
    const company = await seedCompany(integrationDb.pool);
    user = { sub: 'user-1', email: 'pme@fodip.test', roles: ['PME'], permissions: [], entrepriseId: company.id };
  });

  it('a fresh company starts at version 1', async () => {
    const company = await service.getOwn(user);
    expect(company.version).toBe(1);
  });

  it('a correct-version update succeeds and advances the version', async () => {
    const first = await service.updateOwn(user, { version: 1, nombreEmployes: 20 });
    expect(first).toMatchObject({ nombreEmployes: 20, version: 2 });

    // The version returned is what the next edit must present - proven, not assumed.
    const second = await service.updateOwn(user, { version: 2, nombreEmployes: 25 });
    expect(second).toMatchObject({ nombreEmployes: 25, version: 3 });
  });

  it('a stale version is rejected, not silently overwritten', async () => {
    await service.updateOwn(user, { version: 1, nombreEmployes: 20 });

    // Still presenting version 1 - as if this edit had been loaded before the update above.
    await expect(service.updateOwn(user, { version: 1, nombreEmployes: 99 }))
      .rejects.toBeInstanceOf(ConflictException);

    // The rejected write left no trace.
    const current = await service.getOwn(user);
    expect(current.nombreEmployes).toBe(20);
    expect(current.version).toBe(2);
  });

  it('rejects an update against a company that no longer exists', async () => {
    await expect(
      service.updateOwn({ ...user, entrepriseId: '00000000-0000-4000-8000-000000000000' }, { version: 1, nombreEmployes: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('concurrent saves of the same stale version: exactly one wins, the loser gets a real conflict, not a lost update', async () => {
    const results = await Promise.allSettled([
      service.updateOwn(user, { version: 1, nombreEmployes: 30, telephone: '620000001' }),
      service.updateOwn(user, { version: 1, nombreEmployes: 40, telephone: '620000002' }),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);

    // The database holds exactly one of the two edits, in full - never a mix of both (e.g. one
    // call's nombreEmployes with the other's telephone), which a non-transactional read-then-write
    // race could otherwise produce.
    const current = await service.getOwn(user);
    expect(current.version).toBe(2);
    const winner = (fulfilled[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof service.updateOwn>>>).value;
    expect(current.nombreEmployes).toBe((winner as { nombreEmployes: number }).nombreEmployes);
    expect(current.telephone).toBe((winner as { telephone: string }).telephone);
  });
});
