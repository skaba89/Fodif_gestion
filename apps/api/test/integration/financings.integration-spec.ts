/**
 * Real-PostgreSQL integration coverage for the financings lifecycle (Sprint Enterprise 0, Lot 2 -
 * docs/14-ROADMAP-SAAS-PREMIUM.md axe E2). `test/financings.service.spec.ts` already covers the
 * service's own branching logic against mocked repositories; what mocks structurally cannot catch
 * is what happens when two requests race each other against the same row - exactly the class of
 * bug the mission's "double-click / double-submission" and "concurrent requests" scenarios call
 * out. Every test here runs the real FinancingsService + FinancingsRepository + DatabaseService
 * against a disposable postgres:16.10-alpine container (see support/database.ts).
 */
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../../src/auth/auth-user.interface';
import { IdempotencyService } from '../../src/common/idempotency.service';
import { FinancingsRepository } from '../../src/financings/financings.repository';
import { FinancingsService } from '../../src/financings/financings.service';
import { seedEligibleDossier, seedUser } from './support/fixtures';
import { IntegrationDatabase, startIntegrationDatabase } from './support/database';

describe('Financings lifecycle (real PostgreSQL)', () => {
  let integrationDb: IntegrationDatabase;
  let repository: FinancingsRepository;
  let service: FinancingsService;
  let user: AuthenticatedUser;

  beforeAll(async () => {
    integrationDb = await startIntegrationDatabase();
    repository = new FinancingsRepository(integrationDb.db);
    service = new FinancingsService(repository, new IdempotencyService(integrationDb.db));
  }, 120_000);

  afterAll(async () => {
    await integrationDb.stop();
  });

  beforeEach(async () => {
    await integrationDb.reset();
    const agent = await seedUser(integrationDb.pool);
    user = { sub: agent.id, email: 'agent@fodip.test', roles: ['DIRECTION_FODIP'], permissions: [] };
  });

  describe('createFromApplication', () => {
    it('creates a financing with a full amortization schedule from an eligible dossier', async () => {
      const dossier = await seedEligibleDossier(integrationDb.pool, { montantApprouve: 1_200_000, tauxInteret: 6, dureeMois: 12 });

      const financing = await service.createFromApplication(user, dossier.dossierId, {
        dateSignature: '2026-09-02', dateDebut: '2026-10-01',
      });

      expect(financing.montantAccorde).toBe(1_200_000);
      expect(financing.entrepriseId).toBe(dossier.entrepriseId);
      expect(financing.installments).toHaveLength(12);
      // The schedule must fully amortize the principal - capital dues must sum back to the
      // approved amount, not merely "12 rows exist".
      const { rows } = await integrationDb.pool.query<{ capital_du: string }>(
        'SELECT capital_du FROM echeances WHERE financement_id = $1', [financing.id],
      );
      const totalCapitalDue = rows.reduce((sum, row) => sum + Number(row.capital_du), 0);
      expect(totalCapitalDue).toBeCloseTo(1_200_000, 2);

      const audit = await integrationDb.pool.query(
        `SELECT action FROM audit_logs WHERE entity_type = 'FINANCEMENT' AND entity_id = $1`, [financing.id],
      );
      expect(audit.rows.map((row) => row.action)).toContain('CREATE_FINANCING');
    });

    it('rejects a dossier that is not APPROUVE (forbidden state)', async () => {
      const dossier = await seedEligibleDossier(integrationDb.pool);
      await integrationDb.pool.query(`UPDATE dossiers_financement SET statut = 'BROUILLON' WHERE id = $1`, [dossier.dossierId]);

      await expect(service.createFromApplication(user, dossier.dossierId, { dateSignature: '2026-09-02', dateDebut: '2026-10-01' }))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('double-click / double-submission: only one of two concurrent creations for the same dossier succeeds', async () => {
      const dossier = await seedEligibleDossier(integrationDb.pool, { montantApprouve: 500_000, dureeMois: 6 });
      const dto = { dateSignature: '2026-09-02', dateDebut: '2026-10-01' };

      const results = await Promise.allSettled([
        service.createFromApplication(user, dossier.dossierId, dto),
        service.createFromApplication(user, dossier.dossierId, dto),
      ]);

      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[];
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);

      // The database itself (uq_financements_dossier), not just application logic, guarantees this.
      const count = await integrationDb.pool.query('SELECT COUNT(*) AS n FROM financements WHERE dossier_id = $1', [dossier.dossierId]);
      expect(Number(count.rows[0].n)).toBe(1);
    });
  });

  describe('planDisbursement', () => {
    async function createFinancing(montantAccorde: number, dureeMois = 12) {
      const dossier = await seedEligibleDossier(integrationDb.pool, { montantApprouve: montantAccorde, dureeMois });
      return service.createFromApplication(user, dossier.dossierId, { dateSignature: '2026-09-02', dateDebut: '2026-10-01' });
    }

    it('rejects a disbursement that alone exceeds the accorded amount', async () => {
      const financing = await createFinancing(1_000_000);
      await expect(service.planDisbursement(user, financing.id, { montant: 1_000_001, datePrevue: '2026-10-05' }))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects planning against a financing that is not ACTIF (forbidden state transition)', async () => {
      const financing = await createFinancing(1_000_000);
      await integrationDb.pool.query(`UPDATE financements SET statut = 'CLOTURE' WHERE id = $1`, [financing.id]);

      await expect(service.planDisbursement(user, financing.id, { montant: 100_000, datePrevue: '2026-10-05' }))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('concurrent requests: two disbursements that individually fit but together exceed the accorded amount - exactly one succeeds', async () => {
      const financing = await createFinancing(1_000_000);

      const results = await Promise.allSettled([
        service.planDisbursement(user, financing.id, { montant: 700_000, datePrevue: '2026-10-05' }),
        service.planDisbursement(user, financing.id, { montant: 700_000, datePrevue: '2026-10-05' }),
      ]);

      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[];
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      // Either exception is a correct outcome, depending on how the two requests interleave:
      // FinancingsService.planDisbursement reads the committed total via an unlocked this.get(id)
      // *before* the repository's FOR UPDATE transaction - if the two calls overlap, both read the
      // pre-write total and the loser is only caught by the transaction's authoritative re-check
      // (ConflictException); if one call's whole round trip finishes before the other's read even
      // starts, the loser's own outer check already sees the updated total (BadRequestException).
      // Both are the system correctly refusing the over-limit request - the invariant that matters,
      // checked below, is that the committed total never exceeds the accorded amount either way.
      expect([BadRequestException, ConflictException].some((type) => rejected[0].reason instanceof type)).toBe(true);

      const committed = await integrationDb.pool.query(
        `SELECT COALESCE(SUM(montant), 0) AS total FROM decaissements WHERE financement_id = $1 AND statut <> 'ANNULE'`,
        [financing.id],
      );
      expect(Number(committed.rows[0].total)).toBeLessThanOrEqual(1_000_000);
    });
  });

  describe('executeDisbursement', () => {
    let checker: AuthenticatedUser;

    beforeEach(async () => {
      const agent = await seedUser(integrationDb.pool);
      checker = { sub: agent.id, email: 'checker@fodip.test', roles: ['DIRECTION_FODIP'], permissions: [] };
    });

    async function planReadyDisbursement(montantAccorde: number, montant: number) {
      const dossier = await seedEligibleDossier(integrationDb.pool, { montantApprouve: montantAccorde });
      const financing = await service.createFromApplication(user, dossier.dossierId, { dateSignature: '2026-09-02', dateDebut: '2026-10-01' });
      const planned = await service.planDisbursement(user, financing.id, { montant, datePrevue: '2026-10-05' });
      const disbursement = planned.disbursements.find((item) => item.montant === montant)!;
      return { financingId: financing.id, disbursementId: disbursement.id };
    }

    // Axe E5 (docs/14-ROADMAP-SAAS-PREMIUM.md) - maker-checker: the person who planned this
    // disbursement (`user`) is not the one confirming it below (`checker`) in any of these tests
    // except the two dedicated to the rule itself.
    it('forbidden transition: executing an already-EFFECTUE disbursement is rejected', async () => {
      const { financingId, disbursementId } = await planReadyDisbursement(1_000_000, 300_000);
      await service.executeDisbursement(checker, financingId, disbursementId, { dateEffective: '2026-10-06', referenceBancaire: 'REF-1' });

      await expect(service.executeDisbursement(checker, financingId, disbursementId, { dateEffective: '2026-10-07', referenceBancaire: 'REF-2' }))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('concurrent double-execution of the same PREVU disbursement: exactly one wins', async () => {
      const { financingId, disbursementId } = await planReadyDisbursement(1_000_000, 300_000);

      const results = await Promise.allSettled([
        service.executeDisbursement(checker, financingId, disbursementId, { dateEffective: '2026-10-06', referenceBancaire: 'REF-A' }),
        service.executeDisbursement(checker, financingId, disbursementId, { dateEffective: '2026-10-06', referenceBancaire: 'REF-B' }),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);

      const executed = await integrationDb.pool.query(
        `SELECT reference_bancaire FROM decaissements WHERE id = $1 AND statut = 'EFFECTUE'`, [disbursementId],
      );
      expect(executed.rows).toHaveLength(1);
      expect(['REF-A', 'REF-B']).toContain(executed.rows[0].reference_bancaire);
    });

    it('maker-checker: the user who planned the disbursement cannot also execute it', async () => {
      const { financingId, disbursementId } = await planReadyDisbursement(1_000_000, 300_000);

      await expect(service.executeDisbursement(user, financingId, disbursementId, { dateEffective: '2026-10-06', referenceBancaire: 'REF-1' }))
        .rejects.toBeInstanceOf(ForbiddenException);

      // Refused before any write - still PREVU, no executed_by recorded, no audit trail for a
      // self-approved execution that never actually happened.
      const row = await integrationDb.pool.query(
        `SELECT statut, executed_by AS "executedBy" FROM decaissements WHERE id = $1`, [disbursementId],
      );
      expect(row.rows[0]).toEqual({ statut: 'PREVU', executedBy: null });
    });

    it('maker-checker: a different user (checker) can execute what another user (maker) planned, and it is recorded', async () => {
      const { financingId, disbursementId } = await planReadyDisbursement(1_000_000, 300_000);

      await service.executeDisbursement(checker, financingId, disbursementId, { dateEffective: '2026-10-06', referenceBancaire: 'REF-1' });

      const row = await integrationDb.pool.query(
        `SELECT statut, executed_by AS "executedBy", created_by AS "createdBy" FROM decaissements WHERE id = $1`, [disbursementId],
      );
      expect(row.rows[0].statut).toBe('EFFECTUE');
      expect(row.rows[0].executedBy).toBe(checker.sub);
      expect(row.rows[0].createdBy).toBe(user.sub);
      expect(row.rows[0].executedBy).not.toBe(row.rows[0].createdBy);
    });

    it('the database itself enforces maker-checker (ck_decaissements_maker_checker), not just the application', async () => {
      const { disbursementId } = await planReadyDisbursement(1_000_000, 300_000);
      const planner = await integrationDb.pool.query(`SELECT created_by AS "createdBy" FROM decaissements WHERE id = $1`, [disbursementId]);

      await expect(
        integrationDb.pool.query(
          `UPDATE decaissements SET statut = 'EFFECTUE', date_effective = '2026-10-06', reference_bancaire = 'REF-X', executed_by = $2
           WHERE id = $1`,
          [disbursementId, planner.rows[0].createdBy],
        ),
      ).rejects.toThrow(/ck_decaissements_maker_checker/);
    });
  });

  describe('createRepayment', () => {
    async function createFinancingWithInstallment(montantAccorde: number) {
      const dossier = await seedEligibleDossier(integrationDb.pool, { montantApprouve: montantAccorde, dureeMois: 1 });
      const financing = await service.createFromApplication(user, dossier.dossierId, { dateSignature: '2026-09-02', dateDebut: '2026-10-01' });
      const installment = financing.installments[0] as { id: string; montantTotalDu: number };
      return { financingId: financing.id, installment };
    }

    it('rejects an overpayment beyond the amount due for the installment', async () => {
      const { financingId, installment } = await createFinancingWithInstallment(1_000_000);
      await expect(service.createRepayment(user, financingId, {
        echeanceId: installment.id, montant: installment.montantTotalDu + 1, datePaiement: '2026-11-01',
      })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('concurrent double-submission: two repayments that individually fit but together overpay the installment - exactly one succeeds', async () => {
      const { financingId, installment } = await createFinancingWithInstallment(1_000_000);
      const partial = Math.floor((installment.montantTotalDu / 2) + 1); // two of these sum above the total due

      const results = await Promise.allSettled([
        service.createRepayment(user, financingId, { echeanceId: installment.id, montant: partial, datePaiement: '2026-11-01' }),
        service.createRepayment(user, financingId, { echeanceId: installment.id, montant: partial, datePaiement: '2026-11-01' }),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[];
      expect(rejected).toHaveLength(1);
      // Either exception is a correct outcome here too, for the same reason as the planDisbursement
      // concurrency test above: FinancingsService.createRepayment's outer amount check runs against
      // an unlocked read, so which guard actually catches the loser (the transaction's FOR UPDATE
      // re-check vs. the outer pre-check) depends on how the two calls interleave. The invariant
      // that matters - checked below - is that the amount paid never exceeds what's due, either way.
      expect([BadRequestException, ConflictException].some((type) => rejected[0].reason instanceof type)).toBe(true);

      const paid = await integrationDb.pool.query(
        `SELECT COALESCE(SUM(montant_paye), 0) AS total FROM remboursements WHERE echeance_id = $1`, [installment.id],
      );
      expect(Number(paid.rows[0].total)).toBeLessThanOrEqual(installment.montantTotalDu);
    });

    it('marks the installment PAYEE only once it is fully settled, PARTIELLEMENT_PAYEE before that', async () => {
      const { financingId, installment } = await createFinancingWithInstallment(1_000_000);
      const half = Math.floor(installment.montantTotalDu / 2);

      const afterFirst = await service.createRepayment(user, financingId, { echeanceId: installment.id, montant: half, datePaiement: '2026-11-01' });
      const firstInstallment = afterFirst.installments.find((item) => item.id === installment.id) as { statut?: string };
      expect(firstInstallment?.statut).toBe('PARTIELLEMENT_PAYEE');

      const remaining = installment.montantTotalDu - half;
      const afterSecond = await service.createRepayment(user, financingId, { echeanceId: installment.id, montant: remaining, datePaiement: '2026-11-02' });
      const secondInstallment = afterSecond.installments.find((item) => item.id === installment.id) as { statut?: string };
      expect(secondInstallment?.statut).toBe('PAYEE');
    });
  });

  // Axe E5 (docs/14-ROADMAP-SAAS-PREMIUM.md, intégrité financière) - distinct from the "concurrent
  // requests" tests above, which cover two DIFFERENT legitimate submissions racing each other over
  // a shared balance. These cover the other real risk: the SAME submission (same Idempotency-Key)
  // arriving twice - a double click, or a browser retrying a POST after a timeout that actually
  // reached the server. Without this, both calls above would each create their own row as long as
  // the combined total still fit under the ceiling: a real double-spend, not a business rejection.
  describe('idempotency key protection', () => {
    it('planDisbursement: the same key resent sequentially creates exactly one decaissement and replays the first response', async () => {
      const dossier = await seedEligibleDossier(integrationDb.pool, { montantApprouve: 1_000_000, dureeMois: 12 });
      const financing = await service.createFromApplication(user, dossier.dossierId, { dateSignature: '2026-09-02', dateDebut: '2026-10-01' });
      const dto = { montant: 400_000, datePrevue: '2026-10-05' };

      const first = await service.planDisbursement(user, financing.id, dto, 'retry-key-1');
      const second = await service.planDisbursement(user, financing.id, dto, 'retry-key-1');

      // JSON-normalized comparison, not toEqual(first) directly: the real response is what an
      // HTTP client actually receives - always JSON over the wire, replayed or not. The replayed
      // response really did round-trip through the idempotency_keys.corps_reponse JSONB column
      // (Date -> ISO string), while `first` still holds the freshly-computed in-process Date
      // objects; comparing those directly would fail for a reason that never reaches a real
      // caller, since Nest's own response pipeline JSON-serializes every response identically.
      expect(JSON.parse(JSON.stringify(second))).toEqual(JSON.parse(JSON.stringify(first)));
      const rows = await integrationDb.pool.query(
        `SELECT COUNT(*)::int AS total FROM decaissements WHERE financement_id = $1`, [financing.id],
      );
      expect(rows.rows[0].total).toBe(1);
    });

    it('planDisbursement: the same key sent concurrently still only creates one decaissement', async () => {
      const dossier = await seedEligibleDossier(integrationDb.pool, { montantApprouve: 1_000_000, dureeMois: 12 });
      const financing = await service.createFromApplication(user, dossier.dossierId, { dateSignature: '2026-09-02', dateDebut: '2026-10-01' });
      const dto = { montant: 400_000, datePrevue: '2026-10-05' };

      const results = await Promise.allSettled([
        service.planDisbursement(user, financing.id, dto, 'retry-key-2'),
        service.planDisbursement(user, financing.id, dto, 'retry-key-2'),
      ]);
      // The loser of the race is a correct, expected ConflictException ("already being processed")
      // here - not a business rejection like the unkeyed concurrency test above, but the same real
      // invariant: never two rows for one intent. A genuine client retries after that 409 and gets
      // the first call's real response once it has completed (proven by the sequential test above).
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);

      const rows = await integrationDb.pool.query(
        `SELECT COUNT(*)::int AS total FROM decaissements WHERE financement_id = $1`, [financing.id],
      );
      expect(rows.rows[0].total).toBe(1);
    });

    it('planDisbursement: reusing the same key with a genuinely different payload is refused, not silently executed', async () => {
      const dossier = await seedEligibleDossier(integrationDb.pool, { montantApprouve: 1_000_000, dureeMois: 12 });
      const financing = await service.createFromApplication(user, dossier.dossierId, { dateSignature: '2026-09-02', dateDebut: '2026-10-01' });

      await service.planDisbursement(user, financing.id, { montant: 400_000, datePrevue: '2026-10-05' }, 'retry-key-3');
      await expect(
        service.planDisbursement(user, financing.id, { montant: 999_999, datePrevue: '2026-10-06' }, 'retry-key-3'),
      ).rejects.toBeInstanceOf(ConflictException);

      const rows = await integrationDb.pool.query(
        `SELECT COUNT(*)::int AS total FROM decaissements WHERE financement_id = $1`, [financing.id],
      );
      expect(rows.rows[0].total).toBe(1);
    });

    it('createRepayment: the same key resent creates exactly one remboursement and replays the first response', async () => {
      const dossier = await seedEligibleDossier(integrationDb.pool, { montantApprouve: 1_000_000, dureeMois: 1 });
      const financing = await service.createFromApplication(user, dossier.dossierId, { dateSignature: '2026-09-02', dateDebut: '2026-10-01' });
      const installment = financing.installments[0] as { id: string };
      const dto = { echeanceId: installment.id, montant: 250_000, datePaiement: '2026-11-01' };

      const first = await service.createRepayment(user, financing.id, dto, 'repay-key-1');
      const second = await service.createRepayment(user, financing.id, dto, 'repay-key-1');

      // See the planDisbursement replay test above for why this compares JSON, not raw objects.
      expect(JSON.parse(JSON.stringify(second))).toEqual(JSON.parse(JSON.stringify(first)));
      const rows = await integrationDb.pool.query(
        `SELECT COUNT(*)::int AS total FROM remboursements WHERE echeance_id = $1`, [installment.id],
      );
      expect(rows.rows[0].total).toBe(1);
    });

    it('a request without an Idempotency-Key behaves exactly as before this axis existed (no dedup)', async () => {
      const dossier = await seedEligibleDossier(integrationDb.pool, { montantApprouve: 1_000_000, dureeMois: 12 });
      const financing = await service.createFromApplication(user, dossier.dossierId, { dateSignature: '2026-09-02', dateDebut: '2026-10-01' });
      const dto = { montant: 100_000, datePrevue: '2026-10-05' };

      await service.planDisbursement(user, financing.id, dto);
      await service.planDisbursement(user, financing.id, dto);

      const rows = await integrationDb.pool.query(
        `SELECT COUNT(*)::int AS total FROM decaissements WHERE financement_id = $1`, [financing.id],
      );
      expect(rows.rows[0].total).toBe(2);
    });
  });

  describe('transactional integrity', () => {
    it('rolls back the whole transaction when a step inside it fails - no orphan financement is left behind', async () => {
      const dossier = await seedEligibleDossier(integrationDb.pool, { dureeMois: 12 });
      // A duration of 0 slips past the service's own validation only if that validation is ever
      // weakened - buildAmortizationSchedule (finance-policy.js) already rejects it before any
      // query runs, so this asserts the failure happens before the transaction, and confirms no
      // partial row is left in financements either way.
      const application = await repository.findEligibleApplication(dossier.dossierId);
      expect(application).not.toBeNull();

      const brokenSchedule = [{ installmentNumber: 1, dueDate: 'not-a-date', capitalDue: 100, interestDue: 0, totalDue: 100 }];
      await expect(
        repository.createFromApplication(application!, user.sub, '2026-09-02', '2026-10-01', brokenSchedule),
      ).rejects.toThrow();

      const count = await integrationDb.pool.query('SELECT COUNT(*) AS n FROM financements WHERE dossier_id = $1', [dossier.dossierId]);
      expect(Number(count.rows[0].n)).toBe(0);
      const echeances = await integrationDb.pool.query(
        `SELECT COUNT(*) AS n FROM echeances echeance
         JOIN financements financement ON financement.id = echeance.financement_id
         WHERE financement.dossier_id = $1`, [dossier.dossierId],
      );
      expect(Number(echeances.rows[0].n)).toBe(0);
    });
  });
});
