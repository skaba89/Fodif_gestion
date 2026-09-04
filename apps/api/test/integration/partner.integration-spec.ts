/**
 * Real-PostgreSQL integration coverage for the partner-bank portal (Sprint Enterprise 0, Lot 2 -
 * docs/14-ROADMAP-SAAS-PREMIUM.md axe E2, follow-up to financings, committee and administration).
 * The scope guard here (`PARTNER_SCOPE` in partner.repository.ts - correspondent bank OR PME
 * portfolio) is exactly the "cross-bank access" isolation the mission calls out explicitly: a
 * mocked repository can assert the SQL fragment was called, but only a real join against real rows
 * proves one partner bank's data is actually unreachable to another, at both the service layer
 * (get() throwing NotFoundException) and the repository layer (the WHERE clause itself refusing to
 * write, independent of the service's own pre-check - defense in depth worth verifying separately).
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../src/auth/auth-user.interface';
import { IdempotencyService } from '../../src/common/idempotency.service';
import { FinancingsRepository } from '../../src/financings/financings.repository';
import { FinancingsService } from '../../src/financings/financings.service';
import { PartnerRepository } from '../../src/partner/partner.repository';
import { PartnerService } from '../../src/partner/partner.service';
import { seedEligibleDossier, seedPartnerBank, seedUser } from './support/fixtures';
import { IntegrationDatabase, startIntegrationDatabase } from './support/database';

describe('Partner bank portal (real PostgreSQL)', () => {
  let integrationDb: IntegrationDatabase;
  let financingsRepository: FinancingsRepository;
  let financingsService: FinancingsService;
  let repository: PartnerRepository;
  let service: PartnerService;
  let fodipAgent: { sub: string };

  beforeAll(async () => {
    integrationDb = await startIntegrationDatabase();
    financingsRepository = new FinancingsRepository(integrationDb.db);
    financingsService = new FinancingsService(financingsRepository, new IdempotencyService(integrationDb.db));
    repository = new PartnerRepository(integrationDb.db);
    service = new PartnerService(repository, new IdempotencyService(integrationDb.db));
  }, 120_000);

  afterAll(async () => {
    await integrationDb.stop();
  });

  beforeEach(async () => {
    await integrationDb.reset();
    fodipAgent = { sub: (await seedUser(integrationDb.pool)).id };
  });

  function partnerUser(partnerId: string): AuthenticatedUser {
    return { sub: fodipAgent.sub, email: 'partenaire@fodip.test', roles: ['PARTENAIRE_BANCAIRE'], permissions: [], partenaireBancaireId: partnerId };
  }

  /** A real financing (echeances included), created through the actual financings write path. */
  async function createRealFinancing(montantAccorde: number, dureeMois = 12) {
    const dossier = await seedEligibleDossier(integrationDb.pool, { montantApprouve: montantAccorde, dureeMois });
    return financingsService.createFromApplication(fodipAgent as AuthenticatedUser, dossier.dossierId, {
      dateSignature: '2026-09-02', dateDebut: '2026-10-01',
    });
  }

  async function scopeAsCorrespondentBank(financingId: string, partnerId: string) {
    await integrationDb.pool.query('UPDATE financements SET banque_partenaire_id = $2 WHERE id = $1', [financingId, partnerId]);
  }

  async function scopeAsPortfolioPme(entrepriseId: string, partnerId: string) {
    await integrationDb.pool.query(
      'INSERT INTO partenaire_entreprises (partenaire_id, entreprise_id) VALUES ($1, $2)', [partnerId, entrepriseId],
    );
  }

  describe('cross-bank isolation', () => {
    it("never lists another bank's financing, correspondent-scoped or not", async () => {
      const bankA = await seedPartnerBank(integrationDb.pool);
      const bankB = await seedPartnerBank(integrationDb.pool);
      const financingOfB = await createRealFinancing(1_000_000);
      await scopeAsCorrespondentBank(financingOfB.id, bankB.id);

      const { items } = await service.list(partnerUser(bankA.id), { page: 1, limite: 25 });
      const ids = (items as unknown as Array<{ id: string }>).map((item) => item.id);
      expect(ids).not.toContain(financingOfB.id);
    });

    it("refuses to read another bank's financing (NotFoundException, not the real data)", async () => {
      const bankA = await seedPartnerBank(integrationDb.pool);
      const bankB = await seedPartnerBank(integrationDb.pool);
      const financingOfB = await createRealFinancing(1_000_000);
      await scopeAsCorrespondentBank(financingOfB.id, bankB.id);

      await expect(service.get(partnerUser(bankA.id), financingOfB.id)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("refuses to declare a disbursement against another bank's financing", async () => {
      const bankA = await seedPartnerBank(integrationDb.pool);
      const bankB = await seedPartnerBank(integrationDb.pool);
      const financingOfB = await createRealFinancing(1_000_000);
      await scopeAsCorrespondentBank(financingOfB.id, bankB.id);

      await expect(service.createDisbursement(partnerUser(bankA.id), financingOfB.id, {
        montant: 100_000, dateEffective: '2026-10-05', referenceBancaire: 'REF-CROSS-BANK',
      })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('the repository itself refuses the write for an out-of-scope financing, independent of the service pre-check', async () => {
      const bankA = await seedPartnerBank(integrationDb.pool);
      const bankB = await seedPartnerBank(integrationDb.pool);
      const financingOfB = await createRealFinancing(1_000_000);
      await scopeAsCorrespondentBank(financingOfB.id, bankB.id);

      const result = await repository.createDisbursement(bankA.id, financingOfB.id, fodipAgent.sub, {
        montant: 100_000, dateEffective: '2026-10-05', referenceBancaire: 'REF-DIRECT-REPO-CALL',
      });
      expect(result).toBeNull();

      const count = await integrationDb.pool.query('SELECT COUNT(*) AS n FROM decaissements WHERE financement_id = $1', [financingOfB.id]);
      expect(Number(count.rows[0].n)).toBe(0);
    });

    it('grants visibility via the PME portfolio mechanism alone, with no correspondent bank set', async () => {
      const bank = await seedPartnerBank(integrationDb.pool);
      const financing = await createRealFinancing(1_000_000);
      // Deliberately not scoped as correspondent bank - portfolio membership alone must suffice.
      await scopeAsPortfolioPme(financing.entrepriseId, bank.id);

      const fetched = await service.get(partnerUser(bank.id), financing.id);
      expect(fetched.id).toBe(financing.id);
    });
  });

  describe('createDisbursement', () => {
    it('rejects a disbursement that alone exceeds the accorded amount', async () => {
      const bank = await seedPartnerBank(integrationDb.pool);
      const financing = await createRealFinancing(1_000_000);
      await scopeAsCorrespondentBank(financing.id, bank.id);

      await expect(service.createDisbursement(partnerUser(bank.id), financing.id, {
        montant: 1_000_001, dateEffective: '2026-10-05', referenceBancaire: 'REF-1',
      })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('double-click / double-submission: two concurrent declarations that individually fit but together exceed the accorded amount - exactly one succeeds', async () => {
      const bank = await seedPartnerBank(integrationDb.pool);
      const financing = await createRealFinancing(1_000_000);
      await scopeAsCorrespondentBank(financing.id, bank.id);

      const results = await Promise.allSettled([
        service.createDisbursement(partnerUser(bank.id), financing.id, { montant: 700_000, dateEffective: '2026-10-05', referenceBancaire: 'REF-A' }),
        service.createDisbursement(partnerUser(bank.id), financing.id, { montant: 700_000, dateEffective: '2026-10-05', referenceBancaire: 'REF-B' }),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[];
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);

      const committed = await integrationDb.pool.query(
        `SELECT COALESCE(SUM(montant), 0) AS total FROM decaissements WHERE financement_id = $1 AND statut <> 'ANNULE'`, [financing.id],
      );
      expect(Number(committed.rows[0].total)).toBeLessThanOrEqual(1_000_000);
    });

    it('writes an audit entry attributing the declaration to the partner', async () => {
      const bank = await seedPartnerBank(integrationDb.pool);
      const financing = await createRealFinancing(1_000_000);
      await scopeAsCorrespondentBank(financing.id, bank.id);

      await service.createDisbursement(partnerUser(bank.id), financing.id, { montant: 300_000, dateEffective: '2026-10-05', referenceBancaire: 'REF-AUDIT' });

      const audit = await integrationDb.pool.query(
        `SELECT action, new_values AS "newValues" FROM audit_logs WHERE entity_type = 'DECAISSEMENT' AND new_values->>'financementId' = $1`,
        [financing.id],
      );
      expect(audit.rows).toHaveLength(1);
      expect(audit.rows[0].action).toBe('PARTNER_DECLARE_DISBURSEMENT');
      expect(audit.rows[0].newValues.partenaireId).toBe(bank.id);
    });

    // Axe E5 - same protection as financings.integration-spec.ts's own "idempotency key
    // protection" block, verified here too since PartnerService has its own separate write path
    // (partner.repository.ts), not a thin wrapper around FinancingsService.
    it('idempotency key protection: the same key resent creates exactly one decaissement, not two', async () => {
      const bank = await seedPartnerBank(integrationDb.pool);
      const financing = await createRealFinancing(1_000_000);
      await scopeAsCorrespondentBank(financing.id, bank.id);
      const dto = { montant: 300_000, dateEffective: '2026-10-05', referenceBancaire: 'REF-IDEMPOTENT' };

      const first = await service.createDisbursement(partnerUser(bank.id), financing.id, dto, 'partner-retry-1');
      const second = await service.createDisbursement(partnerUser(bank.id), financing.id, dto, 'partner-retry-1');

      expect(JSON.parse(JSON.stringify(second))).toEqual(JSON.parse(JSON.stringify(first)));
      const rows = await integrationDb.pool.query(
        `SELECT COUNT(*)::int AS total FROM decaissements WHERE financement_id = $1`, [financing.id],
      );
      expect(rows.rows[0].total).toBe(1);
    });
  });

  describe('createRepayment', () => {
    it('rejects an overpayment beyond the amount due for the installment', async () => {
      const bank = await seedPartnerBank(integrationDb.pool);
      const financing = await createRealFinancing(1_000_000, 1);
      await scopeAsCorrespondentBank(financing.id, bank.id);
      const installment = financing.installments[0] as { id: string; montantTotalDu: number };

      await expect(service.createRepayment(partnerUser(bank.id), financing.id, {
        echeanceId: installment.id, montant: installment.montantTotalDu + 1, datePaiement: '2026-11-01',
      })).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
