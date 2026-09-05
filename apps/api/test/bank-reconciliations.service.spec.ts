import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BankReconciliationsService } from '../src/reconciliations/bank-reconciliations.service';

const direction = {
  sub: 'direction-1', email: 'direction@fodip.local', roles: ['DIRECTION_FODIP'], permissions: [],
};
const idempotency = {
  run: (_scope: string, _key: string | undefined, _userId: string, _payload: unknown, handler: () => Promise<unknown>) => handler(),
};

describe('BankReconciliationsService', () => {
  it('normalizes monetary values returned by the overview', async () => {
    const repository = { overview: jest.fn().mockResolvedValue({
      items: [{ id: 'm1', montant: '125000', montantOperation: '125000' }],
      summary: { total: 1, rapproches: 1, aRapprocher: 0, montantARapprocher: '0' },
      candidates: [], banks: [], total: 1, page: 1, limite: 25,
    }) };
    const service = new BankReconciliationsService(repository as never, idempotency as never);

    await expect(service.overview({ page: 1, limite: 25 })).resolves.toEqual(expect.objectContaining({
      items: [expect.objectContaining({ montant: 125000, montantOperation: 125000 })],
      summary: expect.objectContaining({ montantARapprocher: 0 }),
    }));
  });

  it('creates an auditable statement entry through the idempotent path', async () => {
    const repository = { createEntry: jest.fn().mockResolvedValue('movement-1') };
    const service = new BankReconciliationsService(repository as never, idempotency as never);
    const dto = {
      banqueId: '00000000-0000-4000-8000-000000000001', referenceExterne: 'REF-1',
      dateOperation: '2026-09-05', sens: 'DEBIT' as const, montant: 300000,
    };

    await expect(service.createEntry(direction, dto, 'entry-key-1')).resolves.toEqual({ id: 'movement-1' });
    expect(repository.createEntry).toHaveBeenCalledWith(direction.sub, dto);
  });

  it('maps a duplicate bank reference to a business conflict', async () => {
    const repository = { createEntry: jest.fn().mockRejectedValue({ code: '23505' }) };
    const service = new BankReconciliationsService(repository as never, idempotency as never);

    await expect(service.createEntry(direction, {
      banqueId: '00000000-0000-4000-8000-000000000001', referenceExterne: 'REF-1',
      dateOperation: '2026-09-05', sens: 'DEBIT', montant: 300000,
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an unknown or inactive partner bank', async () => {
    const repository = { createEntry: jest.fn().mockResolvedValue(null) };
    const service = new BankReconciliationsService(repository as never, idempotency as never);

    await expect(service.createEntry(direction, {
      banqueId: '00000000-0000-4000-8000-000000000001', referenceExterne: 'REF-1',
      dateOperation: '2026-09-05', sens: 'DEBIT', montant: 300000,
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    ['ENTRY_NOT_FOUND', NotFoundException],
    ['ENTRY_ALREADY_MATCHED', ConflictException],
    ['OPERATION_NOT_FOUND', NotFoundException],
    ['OPERATION_ALREADY_MATCHED', ConflictException],
    ['OPERATION_NOT_EXECUTED', ConflictException],
    ['BANK_MISMATCH', BadRequestException],
    ['DIRECTION_MISMATCH', BadRequestException],
  ] as const)('maps repository outcome %s to %s', async (outcome, exceptionType) => {
    const repository = { matchEntry: jest.fn().mockResolvedValue({ outcome }) };
    const service = new BankReconciliationsService(repository as never, idempotency as never);

    await expect(service.matchEntry(direction, 'movement-1', {
      operationType: 'DECAISSEMENT', operationId: '00000000-0000-4000-8000-000000000002',
    })).rejects.toBeInstanceOf(exceptionType);
  });

  it('reports both amounts when reconciliation detects a discrepancy', async () => {
    const repository = { matchEntry: jest.fn().mockResolvedValue({
      outcome: 'AMOUNT_MISMATCH', statementAmount: 300000, operationAmount: 250000,
    }) };
    const service = new BankReconciliationsService(repository as never, idempotency as never);

    await expect(service.matchEntry(direction, 'movement-1', {
      operationType: 'DECAISSEMENT', operationId: '00000000-0000-4000-8000-000000000002',
    })).rejects.toThrow('relevé 300000 GNF, opération 250000 GNF');
  });

  it('returns a confirmed status after a valid match', async () => {
    const repository = { matchEntry: jest.fn().mockResolvedValue({ outcome: 'OK', id: 'match-1' }) };
    const service = new BankReconciliationsService(repository as never, idempotency as never);

    await expect(service.matchEntry(direction, 'movement-1', {
      operationType: 'REMBOURSEMENT', operationId: '00000000-0000-4000-8000-000000000002',
    }, 'match-key-1')).resolves.toEqual({ id: 'match-1', statut: 'RAPPROCHE' });
  });
});
