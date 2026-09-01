import { ForbiddenException } from '@nestjs/common';
import { ApplicationsService } from '../src/applications/applications.service';
import { CompaniesService } from '../src/companies/companies.service';
import { AuthenticatedUser } from '../src/auth/auth-user.interface';

const user = (entrepriseId?: string): AuthenticatedUser => ({ sub: 'user-1', email: 'pme@example.gn', roles: ['PME'], permissions: [], entrepriseId });

describe('PME enterprise isolation', () => {
  it('company service refuses an unscoped PME user', async () => {
    const repository = { findById: jest.fn(), updateById: jest.fn() };
    const service = new CompaniesService(repository as never);
    await expect(service.getOwn(user())).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it('company service always uses enterprise scope from JWT context', async () => {
    const repository = { findById: jest.fn().mockResolvedValue({ id: 'ent-a' }), updateById: jest.fn() };
    const service = new CompaniesService(repository as never);
    await service.getOwn(user('ent-a'));
    expect(repository.findById).toHaveBeenCalledWith('ent-a');
  });

  it('application listing always filters by JWT enterprise scope', async () => {
    const repository = { listByEnterprise: jest.fn().mockResolvedValue([]) };
    const service = new ApplicationsService(repository as never);
    await service.listOwn(user('ent-a'));
    expect(repository.listByEnterprise).toHaveBeenCalledWith('ent-a');
  });

  it('application submission sends both enterprise and user identity to repository', async () => {
    const repository = { submitOwned: jest.fn().mockResolvedValue({ id: 'app-a' }) };
    const service = new ApplicationsService(repository as never);
    await service.submitOwn(user('ent-a'), '11111111-1111-4111-8111-111111111111');
    expect(repository.submitOwned).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'ent-a', 'user-1');
  });
});
