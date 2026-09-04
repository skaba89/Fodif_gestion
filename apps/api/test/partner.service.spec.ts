import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PartnerService } from '../src/partner/partner.service';

const bankUser = {
  sub: 'bank-user-1', email: 'partner@bank.example', roles: ['PARTENAIRE_BANCAIRE'],
  permissions: [], partenaireBancaireId: 'bank-1',
};
const scopelessUser = { sub: 'x', email: 'x@fodip.local', roles: ['PARTENAIRE_BANCAIRE'], permissions: [] };
const idempotency = { run: (_scope: string, _key: string | undefined, _user: string, _payload: unknown, handler: () => Promise<unknown>) => handler() };

describe('PartnerService', () => {
  it('rejects any call from an account without a partner bank scope', async () => {
    const service = new PartnerService({} as never, idempotency as never);
    await expect(service.list(scopelessUser, { page: 1, limite: 25 })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('scopes list/get to the caller own partner id and normalizes numeric fields', async () => {
    const repository = {
      list: jest.fn().mockResolvedValue({ items: [{ id: 'f1', montantAccorde: '1000' }], total: 1, page: 1, limite: 25 }),
      findById: jest.fn().mockResolvedValue({ id: 'f1', montantAccorde: '1000', disbursements: [], installments: [] }),
    };
    const service = new PartnerService(repository as never, idempotency as never);

    await service.list(bankUser, { page: 1, limite: 25 });
    expect(repository.list).toHaveBeenCalledWith('bank-1', { page: 1, limite: 25 });

    const financing = await service.get(bankUser, 'f1');
    expect(repository.findById).toHaveBeenCalledWith('bank-1', 'f1');
    expect(financing.montantAccorde).toBe(1000);
  });

  it('throws not found for a financing outside the partner scope (repository returns null)', async () => {
    const repository = { findById: jest.fn().mockResolvedValue(null) };
    const service = new PartnerService(repository as never, idempotency as never);
    await expect(service.get(bankUser, 'not-mine')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a self-declared disbursement above the remaining balance', async () => {
    const repository = { findById: jest.fn().mockResolvedValue({
      id: 'f1', montantAccorde: '1000', disbursements: [{ montant: '800', statut: 'EFFECTUE' }], installments: [],
    }) };
    const service = new PartnerService(repository as never, idempotency as never);
    await expect(service.createDisbursement(bankUser, 'f1', { montant: 300, dateEffective: '2026-09-10', referenceBancaire: 'REF-1' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('surfaces a conflict when the repository rejects the disbursement (scope lost or balance changed since read)', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({ id: 'f1', montantAccorde: '1000', disbursements: [], installments: [] }),
      createDisbursement: jest.fn().mockResolvedValue(null),
    };
    const service = new PartnerService(repository as never, idempotency as never);
    await expect(service.createDisbursement(bankUser, 'f1', { montant: 300, dateEffective: '2026-09-10', referenceBancaire: 'REF-1' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(repository.createDisbursement).toHaveBeenCalledWith('bank-1', 'f1', 'bank-user-1', expect.objectContaining({ montant: 300 }));
  });

  it('rejects a self-declared repayment above the installment remaining balance', async () => {
    const repository = { findById: jest.fn().mockResolvedValue({
      id: 'f1', montantAccorde: '1000', disbursements: [],
      installments: [{ id: 'e1', montantPaye: 90, montantTotalDu: 100 }],
    }) };
    const service = new PartnerService(repository as never, idempotency as never);
    await expect(service.createRepayment(bankUser, 'f1', { echeanceId: 'e1', montant: 50, datePaiement: '2026-09-10' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a repayment against an installment that does not belong to the financing', async () => {
    const repository = { findById: jest.fn().mockResolvedValue({
      id: 'f1', montantAccorde: '1000', disbursements: [], installments: [],
    }) };
    const service = new PartnerService(repository as never, idempotency as never);
    await expect(service.createRepayment(bankUser, 'f1', { echeanceId: 'not-e1', montant: 10, datePaiement: '2026-09-10' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
