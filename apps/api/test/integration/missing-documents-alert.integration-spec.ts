import { randomUUID } from 'node:crypto';
import { MissingDocumentsAlertService } from '../../src/analytics/missing-documents-alert.service';
import { IntegrationDatabase, startIntegrationDatabase } from './support/database';

describe('MissingDocumentsAlertService (real PostgreSQL)', () => {
  let integrationDb: IntegrationDatabase;
  let service: MissingDocumentsAlertService;

  beforeAll(async () => {
    integrationDb = await startIntegrationDatabase();
    service = new MissingDocumentsAlertService(integrationDb.db);
  }, 120_000);

  afterAll(async () => {
    await integrationDb.stop();
  });

  beforeEach(async () => {
    await integrationDb.reset();
  });

  async function createProgramme(withChecklist = true) {
    const programme = await integrationDb.pool.query<{ id: string }>(
      `INSERT INTO programmes_fodip (code, nom, statut)
       VALUES ($1, 'Programme alerte documentaire QA', 'ACTIVE') RETURNING id`,
      [`PROG-ALERT-${randomUUID().slice(0, 8)}`],
    );
    if (withChecklist) {
      await integrationDb.pool.query(
        `INSERT INTO programme_documents_requis
          (programme_id, code, libelle, type_document, obligatoire, ordre_affichage)
         VALUES
          ($1, 'RCCM', 'RCCM', 'RCCM', TRUE, 10),
          ($1, 'NIF', 'NIF', 'NIF', TRUE, 20)`,
        [programme.rows[0].id],
      );
    }
    return programme.rows[0].id;
  }

  async function createDossier(programmeId: string, statut: string, montant: number) {
    const entreprise = await integrationDb.pool.query<{ id: string }>(
      `INSERT INTO entreprises (code_fodip, raison_sociale, statut)
       VALUES ($1, 'PME alerte documentaire QA', 'ACTIVE') RETURNING id`,
      [`PME-ALERT-${randomUUID().slice(0, 8)}`],
    );
    const dossier = await integrationDb.pool.query<{ id: string }>(
      `INSERT INTO dossiers_financement
        (numero_dossier, entreprise_id, programme_id, montant_demande, objet_financement, statut, date_soumission)
       VALUES ($1, $2, $3, $4, 'Qualification alerte documentaire', $5::varchar(50),
         CASE WHEN $5::varchar(50) = 'BROUILLON' THEN NULL ELSE NOW() END)
       RETURNING id`,
      [`DOS-ALERT-${randomUUID().slice(0, 8)}`, entreprise.rows[0].id, programmeId, montant, statut],
    );
    return dossier.rows[0].id;
  }

  async function addDocument(dossierId: string, typeDocument: 'RCCM' | 'NIF', statutVerification = 'A_VERIFIER') {
    await integrationDb.pool.query(
      `INSERT INTO dossier_documents
        (dossier_id, type_document, nom_fichier, storage_key, statut_verification)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        dossierId,
        typeDocument,
        `${typeDocument.toLowerCase()}.pdf`,
        `qa/${randomUUID()}/${typeDocument.toLowerCase()}.pdf`,
        statutVerification,
      ],
    );
  }

  it('counts only engaged incomplete dossiers and treats a rejected document as still missing', async () => {
    const programmeId = await createProgramme();

    await createDossier(programmeId, 'SOUMIS', 500_000); // RCCM + NIF missing = 2
    await createDossier(programmeId, 'BROUILLON', 900_000); // deliberately ignored

    const complete = await createDossier(programmeId, 'EN_INSTRUCTION', 700_000);
    await addDocument(complete, 'RCCM');
    await addDocument(complete, 'NIF');

    const rejectedNif = await createDossier(programmeId, 'PRET_COMITE', 600_000);
    await addDocument(rejectedNif, 'RCCM');
    await addDocument(rejectedNif, 'NIF', 'REJETE'); // NIF still missing = 1

    const alert = await service.build({});

    expect(alert).toMatchObject({
      id: 'documents-manquants',
      severite: 'attention',
      dossiers: 2,
      montant: 1_100_000,
    });
    expect(alert?.explication).toContain('3 pièce(s) obligatoire(s)');
  });

  it('returns no alert when the programme has no mandatory checklist configured', async () => {
    const programmeId = await createProgramme(false);
    await createDossier(programmeId, 'SOUMIS', 800_000);

    await expect(service.build({})).resolves.toBeNull();
  });

  it('respects the programme filter used by the Direction cockpit', async () => {
    const programmeA = await createProgramme();
    const programmeB = await createProgramme();
    await createDossier(programmeA, 'SOUMIS', 300_000);
    await createDossier(programmeB, 'SOUMIS', 900_000);

    const alert = await service.build({ programmeId: programmeA });

    expect(alert).toMatchObject({ dossiers: 1, montant: 300_000 });
    expect(alert?.explication).toContain('2 pièce(s) obligatoire(s)');
  });
});
