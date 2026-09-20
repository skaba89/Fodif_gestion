import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { canClaimApplication, canReviewApplication } from '../agent-policy';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { AgentApplicationsRepository } from './agent-applications.repository';
import { ListAgentApplicationsDto } from './dto/list-agent-applications.dto';
import { ReviewApplicationDto } from './dto/review-application.dto';

@Injectable()
export class AgentApplicationsService {
  constructor(private readonly applications: AgentApplicationsRepository) {}

  list(user: AuthenticatedUser, query: ListAgentApplicationsDto) {
    return this.applications.list({ ...query, vue: query.vue ?? 'A_PRENDRE' }, user.sub);
  }

  summary(user: AuthenticatedUser) {
    return this.applications.summary(user.sub);
  }

  async get(user: AuthenticatedUser, id: string) {
    const dossier = await this.applications.findById(id);
    if (!dossier) throw new NotFoundException('Application not found');
    if (!this.canRead(user, dossier)) {
      throw new ForbiddenException('Application is outside this agent workload');
    }
    return dossier;
  }

  async claim(user: AuthenticatedUser, id: string) {
    const dossier = await this.get(user, id);
    if (!canClaimApplication(dossier)) throw new ConflictException('Application cannot be claimed');
    const claimed = await this.applications.claim(id, user.sub);
    if (!claimed) throw new ConflictException('Application is already assigned to another agent');
    return this.get(user, id);
  }

  async review(user: AuthenticatedUser, id: string, dto: ReviewApplicationDto) {
    const dossier = await this.get(user, id);
    if (!canReviewApplication(user, dossier, dto.statut)) {
      throw new ForbiddenException('Invalid transition or application not assigned to this agent');
    }
    if (dto.statut === 'PRET_COMITE' && !(await this.applications.isCommitteeReady(id))) {
      throw new ConflictException('A complete score is required before committee submission');
    }
    const updated = await this.applications.transition(id, user.sub, dossier.statut, dto.statut, dto.commentaire.trim());
    if (!updated) throw new ConflictException('Application changed during review');
    return this.get(user, id);
  }

  private canRead(user: AuthenticatedUser, dossier: {
    statut?: string;
    agentResponsableId?: string | null;
    historique?: Array<{ utilisateurId?: string | null }>;
  }): boolean {
    if (user.roles.includes('SUPER_ADMIN')) return true;
    if (dossier.agentResponsableId === user.sub) return true;
    if (dossier.statut === 'SOUMIS' && !dossier.agentResponsableId) return true;
    return dossier.historique?.some((entry) => entry.utilisateurId === user.sub) ?? false;
  }
}
