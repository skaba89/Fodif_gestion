/**
 * Rapprochement bancaire against a real PostgreSQL database. These tests prove the invariants
 * that mocks cannot: unique bank references, transactional matching, cross-bank isolation and
 * the impossibility of reconciling the same financial operation twice under concurrency.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from '../../src/auth/auth-user.interface';
import { IdempotencyService } from '../../src/common/idempotency.service';
import { BankReconciliationsRepository } from '../../src/reconciliations/bank-reconciliations.repository';
import { BankReconciliationsService } from '../../src/reconciliations/bank-reconciliations.service';
import { seedEligibleDossier, seedPartnerBank, seedUser } from './support/fixtures';
import { IntegrationDatabase, startIntegrationDatabase } from './support/database';

describe('Bank reconciliation (real PostgreSQL)', () => {
  let integrationDb: IntegrationDatabase;
  let repository: BankReconciliationsRepository;
  let service: BankReconciliationsService;
  let user: AuthenticatedUser;
  let bankId: string;

  beforeAll(async () => {
    integrationDb = await startIntegrationDatabase();
    repository = new BankReconciliationsRepository(integrationDb.db);
    service = new BankReconciliationsService(repository, new IdempotencyService(integrationDb.db));
  }, 120_000);

  afterAll(async () => integrationDb.stop());

  beforeEach(async () => {
    await integrationDb.reset();
    const actor = await seedUser(integrationDb.pool);
    user = { sub: actor.id, email: 'direction@fodip.test', roles: ['DIRECTION_FODIP'], permissions: [] };
    bankId = (await seedPartnerBank(integrationDb.pool)).id;
  });

  async function seedFinancing(partnerId = bankId) {
    const dossier = await seedEligibleDossier(integrationDb.pool, { montantApprouve: 1_000_000 });
    const financing = await integrationDb.pool.query<{ id: string }>(
      `INSERT INTO financements (
        numero_financement, dossier_id, entreprise_id, montant_accorde, statut,
        banque_partenaire_id, created_by
      ) VALUES ($1, $2, $3, 1000000, 'ACTIF', $4, $5) RETURNING id`,
      [`FIN-REC-${randomUUID().slice(0, 8)}`, dossier.dossierId, dossier.entrepriseId, partnerId, user.sub],
    );
    return financing.rows[0].id;
  }

  async function seedExecutedDisbursement(partnerId = bankId, amount = 300_000) {
    const financingId = await seedFinancing(partnerId);
    const row = await integrationDb.pool.query<{ id: string }>(
      `INSERT INTO decaissements (
        financement_id, numero_decaissement, montant, date_prevue, date_effective,
        reference_bancaire, statut, created_by
      ) VALUES ($1, 1, $2, '2026-09-04', '2026-09-05', $3, 'EFFECTUE', $4) RETURNING id`,
      [financingId, amount, `DEC-${randomUUID().slice(0, 8)}`, user.sub],
    );
    return row.rows[0].id;
  }

  async function seedRepayment(partnerId = bankId, amount = 60_000) {
    const financingId = await seedFinancing(partnerId);
    const row = await integrationDb.pool.query<{ id: string }>(
      `INSERT INTO remboursements (
        financement_id, montant_paye, date_paiement, reference_paiement, moyen_paiement, created_by
      ) VALUES ($1, $2, '2026-09-05', $3, 'VIREMENT', $4) RETURNING id`,
      [financingId, amount, `REM-${randomUUID().slice(0, 8)}`, user.sub],
    );
    return row.rows[0].id;
  }

  async function createStatement(reference: string, options: { partnerId?: string; amount?: number; sens?: 'DEBIT' | 'CREDIT' } = {}) {
    return service.createEntry(user, {
      banqueId: options.partnerId ?? bankId,
      referenceExterne: reference,
      dateOperation: '2026-09-05',
      sens: options.sens ?? 'DEBIT',
      montant: options.amount ?? 300_000,
    });
  }

  it('lists a statement entry as pending and proposes the exact internal operation', async () => {
    const disbursementId = await seedExecutedDisbursement();
    await createStatement('BANK-REF-001');

    const overview = await service.overview({ page: 1, limite: 25 });

    expect(overview.summary).toEqual(expect.objectContaining({ total: 1, rapproches: 0, aRapprocher: 1 }));
    expect(overview.items[0]).toEqual(expect.objectContaining({
      referenceExterne: 'BANK-REF-001', montant: 300_000, statut: 'A_RAPPROCHER',
    }));
    expect(overview.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: disbursementId, operationType: 'DECAISSEMENT', sens: 'DEBIT', montant: 300_000 }),
    ]));
  });

  it('reconciles an exact debit and writes an immutable audit event', async () => {
    const disbursementId = await seedExecutedDisbursement();
    const statement = await createStatement('BANK-REF-002');

    await expect(service.matchEntry(user, statement.id, {
      operationType: 'DECAISSEMENT', operationId: disbursementId, commentaire: 'Référence contrôlée.',
    })).resolves.toEqual(expect.objectContaining({ statut: 'RAPPROCHE' }));

    const overview = await service.overview({ page: 1, limite: 25, statut: 'RAPPROCHE' });
    expect(overview.items).toHaveLength(1);
    expect(overview.items[0]).toEqual(expect.objectContaining({
      decaissementId: disbursementId, statut: 'RAPPROCHE', montantOperation: 300_000,
    }));
    const audit = await integrationDb.pool.query(
      `SELECT action, new_values FROM audit_logs WHERE entity_type = 'RAPPROCHEMENT_BANCAIRE'`,
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].action).toBe('RECONCILE_BANK_ENTRY');
    expect(audit.rows[0].new_values.operationId).toBe(disbursementId);
  });

  it('reconciles a repayment only against a credit movement', async () => {
    const repaymentId = await seedRepayment();
    const statement = await createStatement('BANK-REF-CREDIT-001', { amount: 60_000, sens: 'CREDIT' });

    await service.matchEntry(user, statement.id, {
      operationType: 'REMBOURSEMENT', operationId: repaymentId,
    });

    const row = await integrationDb.pool.query(
      `SELECT remboursement_id FROM rapprochements_bancaires WHERE mouvement_bancaire_id = $1`, [statement.id],
    );
    expect(row.rows[0].remboursement_id).toBe(repaymentId);
  });

  it('rejects a duplicate external reference within the same bank', async () => {
    await createStatement('BANK-REF-DUPLICATE');

    await expect(createStatement('BANK-REF-DUPLICATE')).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses a monetary discrepancy without creating a reconciliation', async () => {
    const disbursementId = await seedExecutedDisbursement(bankId, 250_000);
    const statement = await createStatement('BANK-REF-003', { amount: 300_000 });

    await expect(service.matchEntry(user, statement.id, {
      operationType: 'DECAISSEMENT', operationId: disbursementId,
    })).rejects.toBeInstanceOf(BadRequestException);

    const count = await integrationDb.pool.query(`SELECT COUNT(*)::INT AS total FROM rapprochements_bancaires`);
    expect(count.rows[0].total).toBe(0);
  });

  it('refuses to reconcile an operation belonging to another bank', async () => {
    const otherBank = await seedPartnerBank(integrationDb.pool);
    const disbursementId = await seedExecutedDisbursement(otherBank.id);
    const statement = await createStatement('BANK-REF-004');

    await expect(service.matchEntry(user, statement.id, {
      operationType: 'DECAISSEMENT', operationId: disbursementId,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a credit movement against a disbursement', async () => {
    const disbursementId = await seedExecutedDisbursement();
    const statement = await createStatement('BANK-REF-WRONG-DIRECTION', { sens: 'CREDIT' });

    await expect(service.matchEntry(user, statement.id, {
      operationType: 'DECAISSEMENT', operationId: disbursementId,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a disbursement that has not yet been executed', async () => {
    const financingId = await seedFinancing();
    const planned = await integrationDb.pool.query<{ id: string }>(
      `INSERT INTO decaissements (financement_id, numero_decaissement, montant, date_prevue, statut, created_by)
       VALUES ($1, 1, 300000, '2026-09-05', 'PREVU', $2) RETURNING id`,
      [financingId, user.sub],
    );
    const statement = await createStatement('BANK-REF-NOT-EXECUTED');

    await expect(service.matchEntry(user, statement.id, {
      operationType: 'DECAISSEMENT', operationId: planned.rows[0].id,
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses to match the same statement entry twice', async () => {
    const firstOperation = await seedExecutedDisbursement();
    const secondOperation = await seedExecutedDisbursement();
    const statement = await createStatement('BANK-REF-ONE-ENTRY');
    await service.matchEntry(user, statement.id, { operationType: 'DECAISSEMENT', operationId: firstOperation });

    await expect(service.matchEntry(user, statement.id, {
      operationType: 'DECAISSEMENT', operationId: secondOperation,
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows exactly one of two concurrent statements to claim the same operation', async () => {
    const disbursementId = await seedExecutedDisbursement();
    const first = await createStatement('BANK-REF-005-A');
    const second = await createStatement('BANK-REF-005-B');

    const results = await Promise.allSettled([
      service.matchEntry(user, first.id, { operationType: 'DECAISSEMENT', operationId: disbursementId }),
      service.matchEntry(user, second.id, { operationType: 'DECAISSEMENT', operationId: disbursementId }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[];
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    const count = await integrationDb.pool.query(
      `SELECT COUNT(*)::INT AS total FROM rapprochements_bancaires WHERE decaissement_id = $1`, [disbursementId],
    );
    expect(count.rows[0].total).toBe(1);
  });
});
