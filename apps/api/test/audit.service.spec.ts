import { AuditRepository } from '../src/audit/audit.repository';
import { AuditService } from '../src/audit/audit.service';

describe('AuditService', () => {
  it('forwards the pagination and filter params to the repository (axe B9)', async () => {
    const page = { items: [{ id: 'log-1', action: 'UPDATE_USER' }], total: 12, page: 2, limite: 25 };
    const repository = { list: jest.fn().mockResolvedValue(page) } as unknown as AuditRepository;
    const service = new AuditService(repository);

    await expect(service.list({ page: 2, limite: 25, entityType: 'UTILISATEUR' })).resolves.toEqual(page);

    expect(repository.list).toHaveBeenCalledWith({ page: 2, limite: 25, entityType: 'UTILISATEUR' });
  });
});
