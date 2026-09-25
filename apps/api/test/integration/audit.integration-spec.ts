/**
 * Real-PostgreSQL coverage for the Auditeur drill-down/search filters added to close issue #142's
 * Auditeur checklist ("drill-down dossier/financement/opération", "recherche par identifiant,
 * acteur et période", "preuve chronologique d'un dossier ou financement"). The raw-SQL query in
 * AuditRepository combines optional filters via `($n IS NULL OR ...)` — a mistake there (a stray
 * AND instead of OR, a wrong cast) silently returns zero rows or every row rather than throwing,
 * so this needs a real database and real seeded rows to catch, not a repository mock.
 */
import { randomUUID } from 'node:crypto';
import { AuditRepository } from '../../src/audit/audit.repository';
import { IntegrationDatabase, startIntegrationDatabase } from './support/database';

async function seedUser(pool: IntegrationDatabase['pool'], nom: string, prenom: string, email: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO utilisateurs (email, nom, prenom, password_hash, actif) VALUES ($1, $2, $3, 'x', true) RETURNING id`,
    [email, nom, prenom],
  );
  return result.rows[0].id;
}

async function seedLog(
  pool: IntegrationDatabase['pool'],
  args: { utilisateurId: string; action: string; entityType: string; entityId: string; createdAt: string },
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, created_at)
     VALUES ($1, $2, $3, $4, $5::TIMESTAMPTZ)`,
    [args.utilisateurId, args.action, args.entityType, args.entityId, args.createdAt],
  );
}

describe('AuditRepository drill-down and search filters (real PostgreSQL)', () => {
  let integrationDb: IntegrationDatabase;
  let repository: AuditRepository;

  beforeAll(async () => {
    integrationDb = await startIntegrationDatabase();
    repository = new AuditRepository(integrationDb.db);
  }, 120_000);

  afterAll(async () => {
    await integrationDb.stop();
  });

  beforeEach(async () => {
    await integrationDb.reset();
  });

  it('entityId returns only that entity\'s rows, in chronological order — the "preuve chronologique d\'un dossier" the checklist calls for', async () => {
    const actor = await seedUser(integrationDb.pool, 'Camara', 'Fatoumata', 'auditeur.dossier@fodip.test');
    const dossierId = randomUUID();
    const otherDossierId = randomUUID();
    await seedLog(integrationDb.pool, { utilisateurId: actor, action: 'CREATE_DOSSIER', entityType: 'DOSSIER_FINANCEMENT', entityId: dossierId, createdAt: '2026-09-14T09:00:00Z' });
    await seedLog(integrationDb.pool, { utilisateurId: actor, action: 'UPDATE_DOSSIER', entityType: 'DOSSIER_FINANCEMENT', entityId: dossierId, createdAt: '2026-09-19T09:00:00Z' });
    await seedLog(integrationDb.pool, { utilisateurId: actor, action: 'CREATE_DOSSIER', entityType: 'DOSSIER_FINANCEMENT', entityId: otherDossierId, createdAt: '2026-09-22T09:00:00Z' });

    const result = await repository.list({ page: 1, limite: 25, entityId: dossierId });

    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.action)).toEqual(['UPDATE_DOSSIER', 'CREATE_DOSSIER']);
    expect(result.items.every((item) => item.entityId === dossierId)).toBe(true);
  });

  it('actorSearch matches nom/prenom/email case-insensitively, substring, and excludes non-matches', async () => {
    const camara = await seedUser(integrationDb.pool, 'Camara', 'Fatoumata', 'fatoumata.camara@fodip.test');
    const diallo = await seedUser(integrationDb.pool, 'Diallo', 'Mamadou', 'mamadou.diallo@fodip.test');
    await seedLog(integrationDb.pool, { utilisateurId: camara, action: 'LOGIN', entityType: 'UTILISATEUR', entityId: camara, createdAt: '2026-09-14T09:00:00Z' });
    await seedLog(integrationDb.pool, { utilisateurId: diallo, action: 'LOGIN', entityType: 'UTILISATEUR', entityId: diallo, createdAt: '2026-09-14T09:00:00Z' });

    const byNom = await repository.list({ page: 1, limite: 25, actorSearch: 'cAmArA' });
    expect(byNom.total).toBe(1);
    expect(byNom.items[0].actorEmail).toBe('fatoumata.camara@fodip.test');

    const byEmailFragment = await repository.list({ page: 1, limite: 25, actorSearch: 'mamadou.diallo' });
    expect(byEmailFragment.total).toBe(1);
    expect(byEmailFragment.items[0].actorEmail).toBe('mamadou.diallo@fodip.test');

    const noMatch = await repository.list({ page: 1, limite: 25, actorSearch: 'not-a-real-actor' });
    expect(noMatch.total).toBe(0);
  });

  it('dateFrom/dateTo bound the period — "recherche par ... période"', async () => {
    const actor = await seedUser(integrationDb.pool, 'Bah', 'Ousmane', 'ousmane.bah@fodip.test');
    const outsideOld = randomUUID();
    const inside = randomUUID();
    const outsideNew = randomUUID();
    await seedLog(integrationDb.pool, { utilisateurId: actor, action: 'CREATE_DOSSIER', entityType: 'DOSSIER_FINANCEMENT', entityId: outsideOld, createdAt: '2026-09-01T09:00:00Z' });
    await seedLog(integrationDb.pool, { utilisateurId: actor, action: 'CREATE_DOSSIER', entityType: 'DOSSIER_FINANCEMENT', entityId: inside, createdAt: '2026-09-15T09:00:00Z' });
    await seedLog(integrationDb.pool, { utilisateurId: actor, action: 'CREATE_DOSSIER', entityType: 'DOSSIER_FINANCEMENT', entityId: outsideNew, createdAt: '2026-09-30T09:00:00Z' });

    const result = await repository.list({ page: 1, limite: 25, dateFrom: '2026-09-10T00:00:00Z', dateTo: '2026-09-20T00:00:00Z' });

    expect(result.total).toBe(1);
    expect(result.items[0].entityId).toBe(inside);
  });

  it('combines entityType, entityId, actorSearch and period filters together (AND, not OR)', async () => {
    const camara = await seedUser(integrationDb.pool, 'Camara', 'Fatoumata', 'combo.camara@fodip.test');
    const targetId = randomUUID();
    // Matches every filter individually but not all at once (wrong entity type).
    await seedLog(integrationDb.pool, { utilisateurId: camara, action: 'CREATE_FINANCEMENT', entityType: 'FINANCEMENT', entityId: targetId, createdAt: '2026-09-15T09:00:00Z' });
    // The one row matching every filter at once.
    await seedLog(integrationDb.pool, { utilisateurId: camara, action: 'CREATE_DOSSIER', entityType: 'DOSSIER_FINANCEMENT', entityId: targetId, createdAt: '2026-09-15T09:00:00Z' });

    const result = await repository.list({
      page: 1, limite: 25, entityType: 'DOSSIER_FINANCEMENT', entityId: targetId,
      actorSearch: 'camara', dateFrom: '2026-09-10T00:00:00Z', dateTo: '2026-09-20T00:00:00Z',
    });

    expect(result.total).toBe(1);
    expect(result.items[0].action).toBe('CREATE_DOSSIER');
  });
});
