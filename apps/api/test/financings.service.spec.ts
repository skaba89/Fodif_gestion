import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FinancingsService } from '../src/financings/financings.service';

const direction = { sub: 'direction-1', email: 'direction@fodip.local', roles: ['DIRECTION_FODIP'], permissions: [] };
// Axe E5 (docs/14-ROADMAP-SAAS-PREMIUM.md) - IdempotencyService.run() with no key (none of these
// tests pass one, the 4th, optional argument to createFromApplication/planDisbursement/
// createRepayment) is a pure pass-through to handler(): a fake with the same shape keeps every
// existing assertion below unchanged rather than requiring a real DatabaseService here.
const idempotency = { run: (_scope: string, _key: string | undefined, _user: string, _payload: unknown, handler: () => Promise<unknown>) => handler() };

describe('FinancingsService', () => {
  it('creates a financing and its schedule only from an eligible application', async () => {
    const repository = {
      findEligibleApplication: jest.fn().mockResolvedValue({
        dossierId: 'd1', entrepriseId: 'e1', montantApprouve: '1200000', tauxInteret: '6', dureeMois: 12,
      }),
      createFromApplication: jest.fn().mockResolvedValue('f1'),
      findById: jest.fn().mockResolvedValue({ id: 'f1', montantAccorde: '1200000', disbursements: [], installments: [] }),
    };
    const service = new FinancingsService(repository as never, idempotency as never);
    await service.createFromApplication(direction, 'd1', { dateSignature: '2026-09-02', dateDebut: '2026-10-01' });
    expect(repository.createFromApplication).toHaveBeenCalledWith(
      expect.objectContaining({ dossierId: 'd1' }), 'direction-1', '2026-09-02', '2026-10-01',
      expect.arrayContaining([expect.objectContaining({ installmentNumber: 1 })]),
    );
  });

  it('rejects a non-eligible application', async () => {
    const service = new FinancingsService({ findEligibleApplication: jest.fn().mockResolvedValue(null) } as never, idempotency as never);
    await expect(service.createFromApplication(direction, 'd1', { dateSignature: '2026-09-02', dateDebut: '2026-10-01' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a disbursement above the remaining balance', async () => {
    const repository = { findById: jest.fn().mockResolvedValue({
      id: 'f1', montantAccorde: '1000', disbursements: [{ montant: '800', statut: 'EFFECTUE' }], installments: [],
    }) };
    const service = new FinancingsService(repository as never, idempotency as never);
    await expect(service.planDisbursement(direction, 'f1', { montant: 300, datePrevue: '2026-09-10' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('forwards pagination params to the repository and normalizes numeric fields (axis C5)', async () => {
    const page = { items: [{ id: 'f1', montantAccorde: '1000' }], total: 3, page: 1, limite: 25 };
    const repository = { list: jest.fn().mockResolvedValue(page) };
    const service = new FinancingsService(repository as never, idempotency as never);
    await expect(service.list({ page: 1, limite: 25 })).resolves.toEqual({
      items: [{ id: 'f1', montantAccorde: 1000 }], total: 3, page: 1, limite: 25,
    });
    expect(repository.list).toHaveBeenCalledWith({ page: 1, limite: 25 });
  });

  // Axe E5 (docs/14-ROADMAP-SAAS-PREMIUM.md) - maker-checker on disbursement execution.
  describe('executeDisbursement', () => {
    const found = { id: 'f1', montantAccorde: '1000', disbursements: [], installments: [] };
    const dto = { dateEffective: '2026-09-10', referenceBancaire: 'REF-1' };

    it('rejects execution by the same user who planned the disbursement (self-approval)', async () => {
      const repository = {
        findById: jest.fn().mockResolvedValue(found),
        executeDisbursement: jest.fn().mockResolvedValue({ outcome: 'SELF_APPROVAL' }),
      };
      const service = new FinancingsService(repository as never, idempotency as never);
      await expect(service.executeDisbursement(direction, 'f1', 'd1', dto)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects executing a disbursement that is no longer PREVU', async () => {
      const repository = {
        findById: jest.fn().mockResolvedValue(found),
        executeDisbursement: jest.fn().mockResolvedValue({ outcome: 'INVALID_STATE' }),
      };
      const service = new FinancingsService(repository as never, idempotency as never);
      await expect(service.executeDisbursement(direction, 'f1', 'd1', dto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects executing a disbursement that does not exist', async () => {
      const repository = {
        findById: jest.fn().mockResolvedValue(found),
        executeDisbursement: jest.fn().mockResolvedValue({ outcome: 'NOT_FOUND' }),
      };
      const service = new FinancingsService(repository as never, idempotency as never);
      await expect(service.executeDisbursement(direction, 'f1', 'd1', dto)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('executes when a different user confirms (checker) than the one who planned (maker)', async () => {
      const repository = {
        findById: jest.fn().mockResolvedValue(found),
        executeDisbursement: jest.fn().mockResolvedValue({ outcome: 'OK', id: 'd1' }),
      };
      const service = new FinancingsService(repository as never, idempotency as never);
      await expect(service.executeDisbursement(direction, 'f1', 'd1', dto)).resolves.toEqual(
        expect.objectContaining({ id: 'f1' }),
      );
    });
  });
});
