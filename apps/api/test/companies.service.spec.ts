import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CompaniesService } from '../src/companies/companies.service';

const pme = { sub: 'user-1', email: 'pme@fodip.local', roles: ['PME'], permissions: [], entrepriseId: 'ent-a' };
const dto = { version: 3, raisonSociale: 'Nouvelle raison sociale' };

// Axe E5 (verrouillage optimiste, docs/14-ROADMAP-SAAS-PREMIUM.md).
describe('CompaniesService.updateOwn', () => {
  it('rejects an unscoped PME user without touching the repository', async () => {
    const repository = { updateById: jest.fn() };
    const service = new CompaniesService(repository as never);
    await expect(service.updateOwn({ ...pme, entrepriseId: undefined }, dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.updateById).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the company no longer exists', async () => {
    const repository = { updateById: jest.fn().mockResolvedValue({ outcome: 'NOT_FOUND' }) };
    const service = new CompaniesService(repository as never);
    await expect(service.updateOwn(pme, dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ConflictException, not a silent overwrite, when the version is stale', async () => {
    const repository = { updateById: jest.fn().mockResolvedValue({ outcome: 'VERSION_CONFLICT' }) };
    const service = new CompaniesService(repository as never);
    await expect(service.updateOwn(pme, dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns the refreshed company on a matching version', async () => {
    const company = { id: 'ent-a', raisonSociale: 'Nouvelle raison sociale', version: 4 };
    const repository = { updateById: jest.fn().mockResolvedValue({ outcome: 'OK', company }) };
    const service = new CompaniesService(repository as never);
    await expect(service.updateOwn(pme, dto)).resolves.toEqual(company);
    expect(repository.updateById).toHaveBeenCalledWith('ent-a', dto);
  });
});
