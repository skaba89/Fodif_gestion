import { NotFoundException } from '@nestjs/common';
import { AgentApplicationsRepository } from '../src/agent-applications/agent-applications.repository';
import { AuditRepository } from '../src/audit/audit.repository';
import { AuditService } from '../src/audit/audit.service';

describe('AuditService', () => {
  it('forwards the pagination and filter params to the repository (axe B9)', async () => {
    const page = { items: [{ id: 'log-1', action: 'UPDATE_USER' }], total: 12, page: 2, limite: 25 };
    const repository = { list: jest.fn().mockResolvedValue(page) } as unknown as AuditRepository;
    const agentApplications = { findById: jest.fn() } as unknown as AgentApplicationsRepository;
    const service = new AuditService(repository, agentApplications);

    await expect(service.list({ page: 2, limite: 25, entityType: 'UTILISATEUR' })).resolves.toEqual(page);

    expect(repository.list).toHaveBeenCalledWith({ page: 2, limite: 25, entityType: 'UTILISATEUR' });
  });

  describe('dossier (issue #142 drill-down)', () => {
    it('returns the dossier merged with its audit trail, without any agent-ownership check', async () => {
      const dossier = { id: 'dossier-1', numeroDossier: 'FODIP-2026-001', agentResponsableId: 'someone-else' };
      const auditTrail = [{ id: 'log-1', action: 'CREATE_DOSSIER' }];
      const repository = { dossierAuditTrail: jest.fn().mockResolvedValue(auditTrail) } as unknown as AuditRepository;
      const agentApplications = { findById: jest.fn().mockResolvedValue(dossier) } as unknown as AgentApplicationsRepository;
      const service = new AuditService(repository, agentApplications);

      const result = await service.dossier('dossier-1');

      expect(agentApplications.findById).toHaveBeenCalledWith('dossier-1');
      expect(repository.dossierAuditTrail).toHaveBeenCalledWith('dossier-1');
      expect(result).toEqual({ ...dossier, auditTrail });
    });

    it('throws NotFoundException when the dossier does not exist — AUDITEUR gets a 404, not a leaked null', async () => {
      const repository = { dossierAuditTrail: jest.fn() } as unknown as AuditRepository;
      const agentApplications = { findById: jest.fn().mockResolvedValue(null) } as unknown as AgentApplicationsRepository;
      const service = new AuditService(repository, agentApplications);

      await expect(service.dossier('missing')).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.dossierAuditTrail).not.toHaveBeenCalled();
    });
  });
});
