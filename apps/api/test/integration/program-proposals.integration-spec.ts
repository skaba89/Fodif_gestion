import { randomUUID } from 'node:crypto';
import { ProgramProposalsRepository } from '../../src/programs/program-proposals.repository';
import { ProgramsRepository } from '../../src/programs/programs.repository';
import { IntegrationDatabase, startIntegrationDatabase } from './support/database';

type ProposalView = {
  id: string;
  code: string;
  statut: string;
  regions: Array<{ id: string; code: string; nom: string }>;
  secteurs: Array<{ id: string; code: string; nom: string }>;
  versions: Array<{ version: number; statut: string; submittedAt?: string | null; approvedAt?: string | null }>;
};

type SeedEvidence = {
  regionCodes: string[];
  secteurCodes: string[];
  defaultPrograms: Array<{ code: string; isDefault: boolean; sourceReference: string | null }>;
};

const proposal = (value: unknown) => value as ProposalView;

describe('Programme references and hierarchical proposals (real PostgreSQL)', () => {
  let integrationDb: IntegrationDatabase;
  let proposals: ProgramProposalsRepository;
  let programs: ProgramsRepository;
  let seedEvidence: SeedEvidence;

  beforeAll(async () => {
    integrationDb = await startIntegrationDatabase();
    proposals = new ProgramProposalsRepository(integrationDb.db);
    programs = new ProgramsRepository(integrationDb.db);

    // Capture the migration result before reset() clears business/reference rows between tests.
    const [regions, secteurs, defaults] = await Promise.all([
      integrationDb.pool.query<{ code: string }>('SELECT code FROM regions ORDER BY code'),
      integrationDb.pool.query<{ code: string }>('SELECT code FROM secteurs_activite WHERE actif = TRUE ORDER BY code'),
      integrationDb.pool.query<{ code: string; isDefault: boolean; sourceReference: string | null }>(`
        SELECT code, is_default AS "isDefault", source_reference AS "sourceReference"
        FROM programmes_fodip
        WHERE code IN ('FIER-BOOST', 'EXPORT-TRANSFORMATION', 'ELLEVER')
        ORDER BY code
      `),
    ]);
    seedEvidence = {
      regionCodes: regions.rows.map((row) => row.code),
      secteurCodes: secteurs.rows.map((row) => row.code),
      defaultPrograms: defaults.rows,
    };
  }, 120_000);

  afterAll(async () => {
    await integrationDb.stop();
  });

  beforeEach(async () => {
    await integrationDb.reset();
    // reset() intentionally clears these business reference rows; restore deterministic fixtures
    // for workflow tests without masking the migration evidence captured above.
    await integrationDb.pool.query(`
      INSERT INTO regions(code, nom) VALUES
        ('CONAKRY', 'Conakry'), ('BOKE', 'Boké'), ('KINDIA', 'Kindia'), ('MAMOU', 'Mamou'),
        ('LABE', 'Labé'), ('FARANAH', 'Faranah'), ('KANKAN', 'Kankan'), ('NZEREKORE', 'N''Zérékoré')
      ON CONFLICT (code) DO UPDATE SET nom = EXCLUDED.nom
    `);
    await integrationDb.pool.query(`
      INSERT INTO secteurs_activite(code, nom, actif) VALUES
        ('AGRICULTURE', 'Agriculture', TRUE),
        ('AGRO_INDUSTRIE', 'Agro-industrie', TRUE),
        ('TRANSFORMATION', 'Transformation', TRUE),
        ('COMMERCE', 'Commerce', TRUE),
        ('SERVICES', 'Services', TRUE),
        ('INDUSTRIE', 'Industrie', TRUE),
        ('TECHNOLOGIE', 'Technologie', TRUE),
        ('ARTISANAT', 'Artisanat', TRUE),
        ('TOURISME', 'Tourisme', TRUE),
        ('LOGISTIQUE_TRANSPORT', 'Logistique & Transport', TRUE)
      ON CONFLICT (code) DO UPDATE SET nom = EXCLUDED.nom, actif = TRUE
    `);
  });

  async function actor(label: string) {
    const result = await integrationDb.pool.query<{ id: string }>(
      `INSERT INTO utilisateurs(email, nom, actif) VALUES ($1,$2,TRUE) RETURNING id`,
      [`proposal-${label}-${randomUUID()}@fodip.test`, `Utilisateur ${label}`],
    );
    return result.rows[0].id;
  }

  it('migration installs the default Guinea regions, FODIP sectors and verified default programmes', () => {
    expect(seedEvidence.regionCodes).toEqual([
      'BOKE', 'CONAKRY', 'FARANAH', 'KANKAN', 'KINDIA', 'LABE', 'MAMOU', 'NZEREKORE',
    ]);
    expect(seedEvidence.secteurCodes).toEqual(expect.arrayContaining([
      'AGRICULTURE', 'AGRO_INDUSTRIE', 'TRANSFORMATION', 'COMMERCE', 'SERVICES',
      'INDUSTRIE', 'TECHNOLOGIE', 'ARTISANAT', 'TOURISME', 'LOGISTIQUE_TRANSPORT',
    ]));
    expect(seedEvidence.defaultPrograms).toEqual([
      { code: 'ELLEVER', isDefault: true, sourceReference: 'https://fodip.gov.gn/' },
      { code: 'EXPORT-TRANSFORMATION', isDefault: true, sourceReference: 'https://fodip.gov.gn/' },
      { code: 'FIER-BOOST', isDefault: true, sourceReference: 'https://fodip.gov.gn/' },
    ]);
  });

  it('lets an internal user scope, submit and track a proposal without publishing it before Direction approval', async () => {
    const maker = await actor('maker');
    const checker = await actor('checker');
    const outsider = await actor('outsider');
    const refs = await proposals.references();
    const region = refs.regions.find((row) => row.code === 'KANKAN')!;
    const secteur = refs.secteurs.find((row) => row.code === 'AGRICULTURE')!;
    const code = `PROP-${randomUUID().slice(0, 8).toUpperCase()}`;

    const created = proposal(await proposals.create(maker, {
      code,
      nom: 'Programme proposé QA',
      description: 'Proposition soumise à la hiérarchie',
      montantMin: 100_000,
      montantMax: 3_000_000,
      apportMinPct: 10,
      ancienneteMinMois: 6,
      rccmRequis: true,
      nifRequis: true,
      slaInstructionJours: 15,
      regionIds: [region.id],
      secteurIds: [secteur.id],
      documents: [{ code: 'RCCM', libelle: 'RCCM', typeDocument: 'RCCM', obligatoire: true }],
    }));

    expect(created).toMatchObject({ code, statut: 'BROUILLON' });
    expect(created.regions).toEqual([expect.objectContaining({ code: 'KANKAN' })]);
    expect(created.secteurs).toEqual([expect.objectContaining({ code: 'AGRICULTURE' })]);
    expect(created.versions[0]).toMatchObject({ version: 1, statut: 'BROUILLON' });
    expect((await programs.listActive()).some((entry) => entry.id === created.id)).toBe(false);
    await expect(proposals.getOwn(outsider, created.id)).rejects.toThrow(/introuvable/i);

    const submitted = proposal(await proposals.submit(maker, created.id, 1));
    expect(submitted.versions[0].submittedAt).toBeTruthy();
    await expect(proposals.update(maker, created.id, { nom: 'Modification tardive' })).rejects.toThrow(/soumise/i);
    await expect(proposals.updateRules(maker, created.id, 1, { montantMax: 4_000_000 })).rejects.toThrow(/soumise/i);

    await expect(programs.approveVersion(maker, created.id, 1)).rejects.toThrow(/second acteur/i);
    await programs.approveVersion(checker, created.id, 1);
    await programs.activateVersion(checker, created.id, 1);

    const published = (await programs.listActive()).find((entry) => entry.id === created.id);
    expect(published).toMatchObject({ code, regleVersion: 1, montantMin: '100000.00', montantMax: '3000000.00' });
  });

  it('grants proposal rights to internal preparers without widening programme approval', async () => {
    const rows = await integrationDb.pool.query<{ role: string; permission: string }>(`
      SELECT r.code AS role, p.code AS permission
      FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.code IN ('program.propose', 'program.approve')
      ORDER BY r.code, p.code
    `);
    const grants = rows.rows.map((row) => `${row.role}:${row.permission}`);
    expect(grants).toContain('AGENT_FODIP:program.propose');
    expect(grants).toContain('ANALYSTE:program.propose');
    expect(grants).toContain('DIRECTION_FODIP:program.propose');
    expect(grants).toContain('DIRECTION_FODIP:program.approve');
    expect(grants).toContain('SUPER_ADMIN:program.propose');
    expect(grants).not.toContain('AGENT_FODIP:program.approve');
    expect(grants).not.toContain('ANALYSTE:program.approve');
    expect(grants).not.toContain('PME:program.propose');
    expect(grants).not.toContain('PARTENAIRE_BANCAIRE:program.propose');
  });
});
