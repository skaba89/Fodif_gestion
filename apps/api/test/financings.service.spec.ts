import { BadRequestException, ConflictException } from '@nestjs/common';
import { FinancingsService } from '../src/financings/financings.service';

const direction = { sub: 'direction-1', email: 'direction@fodip.local', roles: ['DIRECTION_FODIP'], permissions: [] };

describe('FinancingsService', () => {
  it('creates a financing and its schedule only from an eligible application', async () => {
    const repository = {
      findEligibleApplication: jest.fn().mockResolvedValue({
        dossierId: 'd1', entrepriseId: 'e1', montantApprouve: '1200000', tauxInteret: '6', dureeMois: 12,
      }),
      createFromApplication: jest.fn().mockResolvedValue('f1'),
      findById: jest.fn().mockResolvedValue({ id: 'f1', montantAccorde: '1200000', disbursements: [], installments: [] }),
    };
    const service = new FinancingsService(repository as never);
    await service.createFromApplication(direction, 'd1', { dateSignature: '2026-09-02', dateDebut: '2026-10-01' });
    expect(repository.createFromApplication).toHaveBeenCalledWith(
      expect.objectContaining({ dossierId: 'd1' }), 'direction-1', '2026-09-02', '2026-10-01',
      expect.arrayContaining([expect.objectContaining({ installmentNumber: 1 })]),
    );
  });

  it('rejects a non-eligible application', async () => {
    const service = new FinancingsService({ findEligibleApplication: jest.fn().mockResolvedValue(null) } as never);
    await expect(service.createFromApplication(direction, 'd1', { dateSignature: '2026-09-02', dateDebut: '2026-10-01' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a disbursement above the remaining balance', async () => {
    const repository = { findById: jest.fn().mockResolvedValue({
      id: 'f1', montantAccorde: '1000', disbursements: [{ montant: '800', statut: 'EFFECTUE' }], installments: [],
    }) };
    const service = new FinancingsService(repository as never);
    await expect(service.planDisbursement(direction, 'f1', { montant: 300, datePrevue: '2026-09-10' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('forwards pagination params to the repository and normalizes numeric fields (axis C5)', async () => {
    const page = { items: [{ id: 'f1', montantAccorde: '1000' }], total: 3, page: 1, limite: 25 };
    const repository = { list: jest.fn().mockResolvedValue(page) };
    const service = new FinancingsService(repository as never);
    await expect(service.list({ page: 1, limite: 25 })).resolves.toEqual({
      items: [{ id: 'f1', montantAccorde: 1000 }], total: 3, page: 1, limite: 25,
    });
    expect(repository.list).toHaveBeenCalledWith({ page: 1, limite: 25 });
  });
});
