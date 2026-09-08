import { randomUUID } from 'node:crypto';
import { ApplicationsRepository } from '../../src/applications/applications.repository';
import { ProgramsRepository } from '../../src/programs/programs.repository';
import { IntegrationDatabase, startIntegrationDatabase } from './support/database';

describe('Programme requirements and dossier completeness (real PostgreSQL)', () => {
  let integrationDb: IntegrationDatabase;
  let programs: ProgramsRepository;
  let applications: ApplicationsRepository;

  beforeAll(async () => {
    integrationDb = await startIntegrationDatabase();
    programs = new ProgramsRepository(integrationDb.db);
    applications = new ApplicationsRepository(integrationDb.db);
  }, 120_000);

  afterAll(async () => {
    await integrationDb.stop();
  });

  beforeEach(async () => {
    await integrationDb.reset();
  });

  async function seedProgrammeAndDossier() {
    const programme = await integrationDb.pool.query<{ id: string }>(
      `INSERT INTO programmes_fodip (
        code, nom, montant_min, montant_max, enveloppe_totale, apport_min_pct,
        anciennete_min_mois, rccm_requis, nif_requis, sla_instruction_jours, statut
      ) VALUES ($1, 'Programme qualification QA', 100000, 5000000, 100000000, 10, 6, TRUE, TRUE, 12, 'ACTIVE')
      RETURNING id`,
      [`PROG-QA-${randomUUID().slice(0, 8)}`],
    );
    const entreprise = await integrationDb.pool.query<{ id: string }>(
      `INSERT INTO entreprises (code_fodip, raison_sociale, statut)
       VALUES ($1, 'PME Checklist QA', 'ACTIVE') RETURNING id`,
      [`PME-QA-${randomUUID().slice(0, 8)}`],
    );
    const dossier = await integrationDb.pool.query<{ id: string }>(
      `INSERT INTO dossiers_financement (
        numero_dossier, entreprise_id, programme_id, montant_demande, objet_financement, statut
      ) VALUES ($1, $2, $3, 750000, 'Qualification documentaire', 'BROUILLON') RETURNING id`,
      [`DOS-QA-${randomUUID().slice(0, 8)}`, entreprise.rows[0].id, programme.rows[0].id],
    );

    await integrationDb.pool.query(
      `INSERT INTO programme_documents_requis (
        programme_id, code, libelle, type_document, obligatoire, ordre_affichage
      ) VALUES
        ($1, 'RCCM', 'RCCM', 'RCCM', TRUE, 10),
        ($1, 'NIF', 'NIF', 'NIF', TRUE, 20),
        ($1, 'BUSINESS_PLAN', 'Plan d’affaires', 'BUSINESS_PLAN', TRUE, 30),
        ($1, 'GARANTIE_OPTIONNELLE', 'Garantie optionnelle', 'GARANTIE', FALSE, 40)`,
      [programme.rows[0].id],
    );

    return {
      programmeId: programme.rows[0].id,
      entrepriseId: entreprise.rows[0].id,
      dossierId: dossier.rows[0].id,
    };
  }

  it('exposes programme eligibility metadata and its active documentary checklist', async () => {
    const { programmeId } = await seedProgrammeAndDossier();

    const result = await programs.listActive();
    const programme = result.find((entry) => entry.id === programmeId);

    expect(programme).toMatchObject({
      montantMin: '100000.00',
      montantMax: '5000000.00',
      enveloppeTotale: '100000000.00',
      apportMinPct: '10.00',
      ancienneteMinMois: 6,
      rccmRequis: true,
      nifRequis: true,
      slaInstructionJours: 12,
    });
    expect(programme.documentsRequis).toEqual([
      expect.objectContaining({ code: 'RCCM', typeDocument: 'RCCM', obligatoire: true }),
      expect.objectContaining({ code: 'NIF', typeDocument: 'NIF', obligatoire: true }),
      expect.objectContaining({ code: 'BUSINESS_PLAN', typeDocument: 'BUSINESS_PLAN', obligatoire: true }),
      expect.objectContaining({ code: 'GARANTIE_OPTIONNELLE', typeDocument: 'GARANTIE', obligatoire: false }),
    ]);
  });

  it('computes dossier completeness from current non-rejected documents only', async () => {
    const { entrepriseId, dossierId } = await seedProgrammeAndDossier();

    let dossier = (await applications.listByEnterprise(entrepriseId)).find((entry) => entry.id === dossierId);
    expect(dossier).toMatchObject({
      documentsRequis: 3,
      documentsPresents: 0,
      completudeDocumentsPct: 0,
    });
    expect(dossier.documentsManquants.map((entry: { code: string }) => entry.code)).toEqual(['RCCM', 'NIF', 'BUSINESS_PLAN']);

    await integrationDb.pool.query(
      `INSERT INTO dossier_documents (
        dossier_id, type_document, nom_fichier, storage_key, statut_verification
      ) VALUES
        ($1, 'RCCM', 'rccm.pdf', 'qa/rccm.pdf', 'A_VERIFIER'),
        ($1, 'NIF', 'nif.pdf', 'qa/nif.pdf', 'REJETE')`,
      [dossierId],
    );

    dossier = (await applications.listByEnterprise(entrepriseId)).find((entry) => entry.id === dossierId);
    expect(dossier).toMatchObject({
      documentsRequis: 3,
      documentsPresents: 1,
      completudeDocumentsPct: 33,
    });
    expect(dossier.documentsManquants.map((entry: { code: string }) => entry.code)).toEqual(['NIF', 'BUSINESS_PLAN']);
  });

  it('treats a programme with no mandatory checklist as complete instead of inventing missing documents', async () => {
    const programme = await integrationDb.pool.query<{ id: string }>(
      `INSERT INTO programmes_fodip (code, nom, statut) VALUES ($1, 'Programme sans checklist', 'ACTIVE') RETURNING id`,
      [`PROG-EMPTY-${randomUUID().slice(0, 8)}`],
    );
    const entreprise = await integrationDb.pool.query<{ id: string }>(
      `INSERT INTO entreprises (code_fodip, raison_sociale, statut) VALUES ($1, 'PME sans checklist', 'ACTIVE') RETURNING id`,
      [`PME-EMPTY-${randomUUID().slice(0, 8)}`],
    );
    await integrationDb.pool.query(
      `INSERT INTO dossiers_financement (numero_dossier, entreprise_id, programme_id, montant_demande, objet_financement, statut)
       VALUES ($1, $2, $3, 250000, 'Sans checklist', 'BROUILLON')`,
      [`DOS-EMPTY-${randomUUID().slice(0, 8)}`, entreprise.rows[0].id, programme.rows[0].id],
    );

    const [dossier] = await applications.listByEnterprise(entreprise.rows[0].id);

    expect(dossier.documentsRequis).toBe(0);
    expect(dossier.documentsPresents).toBe(0);
    expect(dossier.documentsManquants).toEqual([]);
    expect(dossier.completudeDocumentsPct).toBe(100);
  });
});
