import { BadRequestException, ConflictException } from '@nestjs/common';
import { CommitteeService } from '../src/committee/committee.service';

const member = { sub: 'member-1', email: 'comite@fodip.local', roles: ['COMITE_FINANCEMENT'], permissions: [] };

describe('CommitteeService', () => {
  it('rejects a decision when the application is not ready', async () => {
    const repository = { findById: jest.fn().mockResolvedValue({ id: 'd1', statut: 'EN_INSTRUCTION', score: {} }) };
    const service = new CommitteeService(repository as never);
    await expect(service.decide(member, 'd1', { decision: 'REJETE', commentaire: 'Risque élevé' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects approval above the requested amount', async () => {
    const repository = { findById: jest.fn().mockResolvedValue({ id: 'd1', statut: 'PRET_COMITE', montantDemande: 100, score: {} }) };
    const service = new CommitteeService(repository as never);
    await expect(service.decide(member, 'd1', { decision: 'APPROUVE', montantApprouve: 120, dureeMois: 12 }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('records a valid human decision with optimistic workflow protection', async () => {
    const ready = { id: 'd1', statut: 'PRET_COMITE', montantDemande: 100, score: { scoreTotal: 82 } };
    const approved = { ...ready, statut: 'APPROUVE' };
    const repository = {
      findById: jest.fn().mockResolvedValueOnce(ready).mockResolvedValueOnce(approved),
      decide: jest.fn().mockResolvedValue({ id: 'd1' }),
    };
    const service = new CommitteeService(repository as never);
    await service.decide(member, 'd1', { decision: 'APPROUVE', montantApprouve: 90, dureeMois: 24 });
    expect(repository.decide).toHaveBeenCalledWith('d1', 'member-1', expect.objectContaining({ decision: 'APPROUVE' }));
  });

  it('forwards pagination params to the repository (axis C5)', async () => {
    const page = { items: [{ id: 'd1' }], total: 42, page: 2, limite: 25 };
    const repository = { list: jest.fn().mockResolvedValue(page) };
    const service = new CommitteeService(repository as never);
    await expect(service.list({ page: 2, limite: 25 })).resolves.toEqual(page);
    expect(repository.list).toHaveBeenCalledWith({ page: 2, limite: 25 });
  });
});
