import { randomUUID } from 'node:crypto';
import { ProgramsRepository } from '../../src/programs/programs.repository';
import { IntegrationDatabase, startIntegrationDatabase } from './support/database';

type ManagementVersion = {
  id: string;
  version: number;
  statut: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  documents: Array<Record<string, unknown>>;
};
type ManagementView = {
  id: string;
  code: string;
  statut: string;
  createdVersion?: number;
  versions: ManagementVersion[];
};
const view = (value: unknown) => value as ManagementView;

describe('Programme institutional lifecycle (real PostgreSQL)', () => {
  let integrationDb: IntegrationDatabase;
  let programs: ProgramsRepository;

  beforeAll(async () => {
    integrationDb = await startIntegrationDatabase();
    programs = new ProgramsRepository(integrationDb.db);
  }, 120_000);

  afterAll(async () => {
    await integrationDb.stop();
  });

  beforeEach(async () => {
    await integrationDb.reset();
  });

  async function actor(label: string) {
    const result = await integrationDb.pool.query<{ id: string }>(
      `INSERT INTO utilisateurs (email, nom, actif)
       VALUES ($1, $2, TRUE) RETURNING id`,
      [`program-${label}-${randomUUID()}@fodip.test`, `Direction ${label}`],
    );
    return result.rows[0].id;
  }

  it('creates a programme as an unpublished draft and publishes it only after independent approval', async () => {
    const maker = await actor('maker');
    const checker = await actor('checker');
    const code = `PROG-${randomUUID().slice(0, 8).toUpperCase()}`;

    const created = view(await programs.createProgram(maker, {
      code,
      nom: 'Programme institutionnel QA',
      description: 'Qualification du cycle programmes',
      enveloppeTotale: 1_000_000_000,
      montantMin: 100_000,
      montantMax: 5_000_000,
      apportMinPct: 10,
      ancienneteMinMois: 6,
      rccmRequis: true,
      nifRequis: true,
      slaInstructionJours: 15,
      documents: [
        { code: 'RCCM', libelle: 'RCCM', typeDocument: 'RCCM', obligatoire: true, ordreAffichage: 10 },
        { code: 'BUSINESS_PLAN', libelle: "Plan d'affaires", typeDocument: 'BUSINESS_PLAN', obligatoire: true, ordreAffichage: 20 },
      ],
    }));

    expect(created).toMatchObject({ code, statut: 'BROUILLON' });
    expect(created.versions[0]).toMatchObject({ version: 1, statut: 'BROUILLON' });
    expect((await programs.listActive()).some((entry) => entry.id === created.id)).toBe(false);

    const submitted = view(await programs.submitVersion(maker, created.id, 1));
    expect(submitted.versions[0].submittedAt).toBeTruthy();

    await expect(programs.approveVersion(maker, created.id, 1)).rejects.toThrow(/second acteur/i);

    const approved = view(await programs.approveVersion(checker, created.id, 1));
    expect(approved.versions[0].approvedAt).toBeTruthy();
    expect(approved.versions[0].approvedBy).toBe(checker);

    const activated = view(await programs.activateVersion(checker, created.id, 1));
    expect(activated).toMatchObject({ statut: 'ACTIVE' });
    expect(activated.versions[0]).toMatchObject({ version: 1, statut: 'ACTIVE' });

    const published = (await programs.listActive()).find((entry) => entry.id === created.id);
    expect(published).toMatchObject({ code, regleVersion: 1, apportMinPct: '10.00', ancienneteMinMois: 6, rccmRequis: true, nifRequis: true });
    expect(published!.documentsRequis).toEqual([
      expect.objectContaining({ code: 'RCCM', obligatoire: true }),
      expect.objectContaining({ code: 'BUSINESS_PLAN', obligatoire: true }),
    ]);
  });

  it('creates V2 from V1 and archives V1 without changing a dossier locked on V1', async () => {
    const maker = await actor('maker-v2');
    const checker = await actor('checker-v2');
    const enterprise = await integrationDb.pool.query<{ id: string }>(
      `INSERT INTO entreprises (code_fodip, raison_sociale, statut)
       VALUES ($1, 'PME Programme Lifecycle QA', 'ACTIVE') RETURNING id`,
      [`PME-${randomUUID().slice(0, 8)}`],
    );

    const created = view(await programs.createProgram(maker, {
      code: `LIFE-${randomUUID().slice(0, 8).toUpperCase()}`,
      nom: 'Programme lifecycle QA',
      montantMin: 100_000,
      montantMax: 1_000_000,
      apportMinPct: 5,
      documents: [{ code: 'RCCM', libelle: 'RCCM', typeDocument: 'RCCM', obligatoire: true }],
    }));
    await programs.submitVersion(maker, created.id, 1);
    await programs.approveVersion(checker, created.id, 1);
    await programs.activateVersion(checker, created.id, 1);

    const v1 = view(await programs.getManagement(created.id)).versions.find((version) => version.version === 1)!;
    const dossier = await integrationDb.pool.query<{ id: string }>(
      `INSERT INTO dossiers_financement (
         numero_dossier, entreprise_id, programme_id, programme_regle_version_id,
         montant_demande, objet_financement, statut, date_soumission
       ) VALUES ($1,$2,$3,$4,250000,'Historique V1','SOUMIS',NOW()) RETURNING id`,
      [`DOS-${randomUUID().slice(0, 8)}`, enterprise.rows[0].id, created.id, v1.id],
    );

    let current = view(await programs.createDraftVersion(maker, created.id));
    expect(current.createdVersion).toBe(2);
    expect(current.versions.find((version) => version.version === 2)?.documents).toEqual([expect.objectContaining({ code: 'RCCM' })]);

    current = view(await programs.updateDraftVersion(maker, created.id, 2, {
      montantMin: 200_000,
      montantMax: 2_000_000,
      apportMinPct: 15,
      documents: [{ code: 'NIF', libelle: 'NIF', typeDocument: 'NIF', obligatoire: true }],
    }));
    expect(current.versions.find((version) => version.version === 2)?.approvedAt).toBeNull();

    await programs.submitVersion(maker, created.id, 2);
    await programs.approveVersion(checker, created.id, 2);
    const activated = view(await programs.activateVersion(checker, created.id, 2));

    expect(activated.versions.find((version) => version.version === 1)).toMatchObject({ statut: 'ARCHIVEE' });
    expect(activated.versions.find((version) => version.version === 2)).toMatchObject({ statut: 'ACTIVE' });

    const locked = await integrationDb.pool.query<{ programme_regle_version_id: string }>(
      `SELECT programme_regle_version_id FROM dossiers_financement WHERE id = $1`, [dossier.rows[0].id],
    );
    expect(locked.rows[0].programme_regle_version_id).toBe(v1.id);

    const published = (await programs.listActive()).find((entry) => entry.id === created.id);
    expect(published).toMatchObject({ regleVersion: 2, montantMin: '200000.00', apportMinPct: '15.00' });
    expect(published!.documentsRequis).toEqual([expect.objectContaining({ code: 'NIF', typeDocument: 'NIF' })]);
  });

  it('installs explicit programme permissions without granting management to non-Direction business roles', async () => {
    const rows = await integrationDb.pool.query<{ role: string; permission: string }>(`
      SELECT r.code AS role, p.code AS permission
      FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.code IN ('program.read', 'program.manage', 'program.approve')
      ORDER BY r.code, p.code
    `);
    const grants = rows.rows.map((row) => `${row.role}:${row.permission}`);
    expect(grants).toContain('PME:program.read');
    expect(grants).toContain('AGENT_FODIP:program.read');
    expect(grants).toContain('COMITE_FINANCEMENT:program.read');
    expect(grants).toContain('DIRECTION_FODIP:program.manage');
    expect(grants).toContain('DIRECTION_FODIP:program.approve');
    expect(grants).toContain('AUDITEUR:program.read');
    expect(grants).not.toContain('AGENT_FODIP:program.manage');
    expect(grants).not.toContain('AUDITEUR:program.manage');
  });
});
