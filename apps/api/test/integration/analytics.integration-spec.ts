/**
 * Real-PostgreSQL coverage for the executive cockpit's analytics SQL (mission "présentation
 * Directeur général", feat/dg-premium-presentation) - date-arithmetic-heavy alert queries and the
 * new `vw_financing_performance.banque_partenaire_id` column (database/014_executive_cockpit.sql)
 * that test/analytics.service.spec.ts's mocked-repository tests structurally cannot exercise:
 * whether the real SQL, against a real Postgres, actually finds what each alert claims to find.
 */
import { randomUUID } from 'node:crypto';
import { AnalyticsRepository } from '../../src/analytics/analytics.repository';
import { seedEligibleDossier, seedPartnerBank, seedUser } from './support/fixtures';
import { IntegrationDatabase, startIntegrationDatabase } from './support/database';

describe('Analytics repository - executive cockpit (real PostgreSQL)', () => {
  let integrationDb: IntegrationDatabase;
  let repository: AnalyticsRepository;

  beforeAll(async () => {
    integrationDb = await startIntegrationDatabase();
    repository = new AnalyticsRepository(integrationDb.db);
  }, 120_000);

  afterAll(async () => {
    await integrationDb.stop();
  });

  beforeEach(async () => {
    await integrationDb.reset();
  });

  /** A financement ACTIF signed today from a freshly-approved dossier, optionally at a bank. */
  async function seedActiveFinancement(options: { montantApprouve?: number; banqueId?: string } = {}) {
    const dossier = await seedEligibleDossier(integrationDb.pool, { montantApprouve: options.montantApprouve ?? 1_000_000 });
    const numero = `FIN-TEST-${randomUUID().slice(0, 8)}`;
    const financement = await integrationDb.pool.query<{ id: string }>(
      `INSERT INTO financements (numero_financement, dossier_id, entreprise_id, montant_accorde, statut, banque_partenaire_id)
       VALUES ($1, $2, $3, $4, 'ACTIF', $5) RETURNING id`,
      [numero, dossier.dossierId, dossier.entrepriseId, dossier.montantApprouve, options.banqueId ?? null],
    );
    return { financementId: financement.rows[0].id, ...dossier };
  }

  describe('the new banque filter on vw_financing_performance', () => {
    it('scopes montantDecaisse to only the financements of the filtered bank, excluding another bank’s real disbursement', async () => {
      const bankA = await seedPartnerBank(integrationDb.pool);
      const bankB = await seedPartnerBank(integrationDb.pool);
      const financingA = await seedActiveFinancement({ montantApprouve: 1_000_000, banqueId: bankA.id });
      const financingB = await seedActiveFinancement({ montantApprouve: 2_000_000, banqueId: bankB.id });
      await integrationDb.pool.query(
        `INSERT INTO decaissements (financement_id, numero_decaissement, montant, date_prevue, date_effective, reference_bancaire, statut)
         VALUES ($1, 1, 1000000, CURRENT_DATE, CURRENT_DATE, 'REF-A', 'EFFECTUE')`,
        [financingA.financementId],
      );
      await integrationDb.pool.query(
        `INSERT INTO decaissements (financement_id, numero_decaissement, montant, date_prevue, date_effective, reference_bancaire, statut)
         VALUES ($1, 1, 2000000, CURRENT_DATE, CURRENT_DATE, 'REF-B', 'EFFECTUE')`,
        [financingB.financementId],
      );

      const scoped = await repository.dashboard({ banqueId: bankA.id });
      const unscoped = await repository.dashboard({});

      expect(Number(scoped.financing.montantDecaisse)).toBe(1_000_000);
      expect(Number(unscoped.financing.montantDecaisse)).toBe(3_000_000);
      expect(scoped.banks).toHaveLength(1);
      expect(Number(scoped.banks[0].montantDecaisse)).toBe(1_000_000);
    });
  });

  describe('alerts()', () => {
    it('finds a real overdue installment: a past échéance with less remboursé than due', async () => {
      const { financementId } = await seedActiveFinancement({ montantApprouve: 500_000 });
      await integrationDb.pool.query(
        `INSERT INTO echeances (financement_id, numero_echeance, date_echeance, capital_du, interet_du, montant_total_du, statut)
         VALUES ($1, 1, CURRENT_DATE - INTERVAL '10 days', 100000, 5000, 105000, 'EN_RETARD')`,
        [financementId],
      );

      const alerts = await repository.alerts({});

      expect(alerts.overdueInstallments.dossiers).toBe(1);
      expect(Number(alerts.overdueInstallments.montant)).toBe(105000);
    });

    it('does not flag an échéance that has been fully remboursée', async () => {
      const { financementId } = await seedActiveFinancement({ montantApprouve: 500_000 });
      const echeance = await integrationDb.pool.query<{ id: string }>(
        `INSERT INTO echeances (financement_id, numero_echeance, date_echeance, capital_du, interet_du, montant_total_du, statut)
         VALUES ($1, 1, CURRENT_DATE - INTERVAL '10 days', 100000, 5000, 105000, 'PAYEE') RETURNING id`,
        [financementId],
      );
      await integrationDb.pool.query(
        `INSERT INTO remboursements (financement_id, echeance_id, montant_paye, date_paiement)
         VALUES ($1, $2, 105000, CURRENT_DATE - INTERVAL '9 days')`,
        [financementId, echeance.rows[0].id],
      );

      const alerts = await repository.alerts({});

      expect(alerts.overdueInstallments.dossiers).toBe(0);
    });

    it('finds a real overdue disbursement: a PREVU decaissement whose date_prevue has passed', async () => {
      const { financementId } = await seedActiveFinancement();
      await integrationDb.pool.query(
        `INSERT INTO decaissements (financement_id, numero_decaissement, montant, date_prevue, statut)
         VALUES ($1, 1, 300000, CURRENT_DATE - INTERVAL '5 days', 'PREVU')`,
        [financementId],
      );

      const alerts = await repository.alerts({});

      expect(alerts.overdueDisbursements.dossiers).toBe(1);
      expect(Number(alerts.overdueDisbursements.montant)).toBe(300000);
    });

    it('does not flag a decaissement whose date_prevue is still in the future', async () => {
      const { financementId } = await seedActiveFinancement();
      await integrationDb.pool.query(
        `INSERT INTO decaissements (financement_id, numero_decaissement, montant, date_prevue, statut)
         VALUES ($1, 1, 300000, CURRENT_DATE + INTERVAL '5 days', 'PREVU')`,
        [financementId],
      );

      const alerts = await repository.alerts({});

      expect(alerts.overdueDisbursements.dossiers).toBe(0);
    });

    it('finds a dossier blocked past the instruction SLA (updated_at older than the threshold)', async () => {
      const agent = await seedUser(integrationDb.pool);
      const entreprise = await integrationDb.pool.query<{ id: string }>(
        `INSERT INTO entreprises (code_fodip, raison_sociale, statut) VALUES ($1, $2, 'ACTIVE') RETURNING id`,
        [`FODIP-TEST-${randomUUID().slice(0, 8)}`, 'Entreprise Bloquée Test'],
      );
      const dossier = await integrationDb.pool.query<{ id: string }>(
        `INSERT INTO dossiers_financement (numero_dossier, entreprise_id, montant_demande, objet_financement, statut, agent_responsable_id)
         VALUES ($1, $2, 800000, 'Test SLA', 'EN_INSTRUCTION', $3) RETURNING id`,
        [`DOS-TEST-${randomUUID().slice(0, 8)}`, entreprise.rows[0].id, agent.id],
      );
      // Backdated well past the 15-day SLA constant (AnalyticsRepository.SLA_INSTRUCTION_JOURS) -
      // a fresh dossier's own NOW() default would never trigger this alert, which is the point.
      await integrationDb.pool.query(
        `UPDATE dossiers_financement SET updated_at = NOW() - INTERVAL '30 days' WHERE id = $1`,
        [dossier.rows[0].id],
      );

      const alerts = await repository.alerts({});

      expect(alerts.blockedApplications.dossiers).toBe(1);
    });

    it('does not flag a dossier still comfortably within the SLA window', async () => {
      const entreprise = await integrationDb.pool.query<{ id: string }>(
        `INSERT INTO entreprises (code_fodip, raison_sociale, statut) VALUES ($1, $2, 'ACTIVE') RETURNING id`,
        [`FODIP-TEST-${randomUUID().slice(0, 8)}`, 'Entreprise Récente Test'],
      );
      await integrationDb.pool.query(
        `INSERT INTO dossiers_financement (numero_dossier, entreprise_id, montant_demande, objet_financement, statut)
         VALUES ($1, $2, 800000, 'Test SLA', 'EN_INSTRUCTION')`,
        [`DOS-TEST-${randomUUID().slice(0, 8)}`, entreprise.rows[0].id],
      );

      const alerts = await repository.alerts({});

      expect(alerts.blockedApplications.dossiers).toBe(0);
    });

    it('finds an active financement with no impact follow-up at all', async () => {
      await seedActiveFinancement();

      const alerts = await repository.alerts({});

      expect(alerts.staleImpact.dossiers).toBe(1);
    });

    it('does not flag an active financement with a recent suivi d’impact', async () => {
      const { financementId, entrepriseId } = await seedActiveFinancement();
      await integrationDb.pool.query(
        `INSERT INTO suivis_impact (entreprise_id, financement_id, periode, nombre_employes)
         VALUES ($1, $2, CURRENT_DATE - INTERVAL '1 month', 5)`,
        [entrepriseId, financementId],
      );

      const alerts = await repository.alerts({});

      expect(alerts.staleImpact.dossiers).toBe(0);
    });

    it('groups overdue amounts by bank for overdueByBank, real join through partenaires_bancaires', async () => {
      const bank = await seedPartnerBank(integrationDb.pool);
      const { financementId } = await seedActiveFinancement({ banqueId: bank.id });
      await integrationDb.pool.query(
        `INSERT INTO echeances (financement_id, numero_echeance, date_echeance, capital_du, interet_du, montant_total_du, statut)
         VALUES ($1, 1, CURRENT_DATE - INTERVAL '3 days', 50000, 2000, 52000, 'EN_RETARD')`,
        [financementId],
      );

      const alerts = await repository.alerts({});

      const row = alerts.overdueByBank.find((entry) => entry.id === bank.id);
      expect(row).toBeDefined();
      expect(Number(row!.montant)).toBe(52000);
    });
  });

  describe('periodTotals()', () => {
    it('scopes montantDemande to dossiers submitted within the given [from, to] window', async () => {
      const inWindow = await seedEligibleDossier(integrationDb.pool, { montantDemande: 400_000 });
      await integrationDb.pool.query(
        `UPDATE dossiers_financement SET date_soumission = '2026-02-15' WHERE id = $1`, [inWindow.dossierId],
      );
      const outOfWindow = await seedEligibleDossier(integrationDb.pool, { montantDemande: 900_000 });
      await integrationDb.pool.query(
        `UPDATE dossiers_financement SET date_soumission = '2026-01-01' WHERE id = $1`, [outOfWindow.dossierId],
      );

      const totals = await repository.periodTotals({}, '2026-02-01', '2026-02-28');

      expect(Number(totals.montantDemande)).toBe(400_000);
    });
  });
});
