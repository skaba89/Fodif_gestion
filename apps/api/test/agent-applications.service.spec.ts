import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AgentApplicationsService } from '../src/agent-applications/agent-applications.service';

const agent = {
  sub: 'agent-a', email: 'agent@fodip.local', roles: ['AGENT_FODIP'], permissions: ['application.review'],
};

describe('AgentApplicationsService', () => {
  it('scopes workload views to the authenticated user id', async () => {
    const repository = { list: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limite: 25 }) };
    const service = new AgentApplicationsService(repository as never);
    const query = { page: 1, limite: 25, vue: 'MES_DOSSIERS' };
    await service.list(agent, query);
    expect(repository.list).toHaveBeenCalledWith(query, 'agent-a');
  });

  it('scopes dashboard summary to the authenticated user id', async () => {
    const repository = { summary: jest.fn().mockResolvedValue({ mesDossiers: 2 }) };
    const service = new AgentApplicationsService(repository as never);
    await service.summary(agent);
    expect(repository.summary).toHaveBeenCalledWith('agent-a');
  });

  it('cannot claim a dossier already at committee stage', async () => {
    const repository = { findById: jest.fn().mockResolvedValue({ id: 'd1', statut: 'PRET_COMITE' }) };
    const service = new AgentApplicationsService(repository as never);
    await expect(service.claim(agent, 'd1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('cannot review a dossier assigned to another agent', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({ id: 'd1', statut: 'EN_INSTRUCTION', agentResponsableId: 'agent-b' }),
      transition: jest.fn(),
      isCommitteeReady: jest.fn().mockResolvedValue(true),
    };
    const service = new AgentApplicationsService(repository as never);
    await expect(service.review(agent, 'd1', { statut: 'PRET_COMITE', commentaire: 'Analyse terminée' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.transition).not.toHaveBeenCalled();
  });

  it('uses optimistic status matching for a valid review transition', async () => {
    const dossier = { id: 'd1', statut: 'EN_INSTRUCTION', agentResponsableId: 'agent-a' };
    const repository = {
      findById: jest.fn().mockResolvedValueOnce(dossier).mockResolvedValueOnce({ ...dossier, statut: 'PRET_COMITE' }),
      transition: jest.fn().mockResolvedValue({ id: 'd1' }),
      isCommitteeReady: jest.fn().mockResolvedValue(true),
    };
    const service = new AgentApplicationsService(repository as never);
    await service.review(agent, 'd1', { statut: 'PRET_COMITE', commentaire: ' Analyse terminée ' });
    expect(repository.transition).toHaveBeenCalledWith('d1', 'agent-a', 'EN_INSTRUCTION', 'PRET_COMITE', 'Analyse terminée');
  });

  it('blocks committee submission until scoring is complete', async () => {
    const dossier = { id: 'd1', statut: 'EN_INSTRUCTION', agentResponsableId: 'agent-a' };
    const repository = {
      findById: jest.fn().mockResolvedValue(dossier),
      isCommitteeReady: jest.fn().mockResolvedValue(false),
      transition: jest.fn(),
    };
    const service = new AgentApplicationsService(repository as never);
    await expect(service.review(agent, 'd1', { statut: 'PRET_COMITE', commentaire: 'Analyse terminée' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(repository.transition).not.toHaveBeenCalled();
  });
});
