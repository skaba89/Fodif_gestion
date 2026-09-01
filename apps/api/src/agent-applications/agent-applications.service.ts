import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { canClaimApplication, canReviewApplication } from '../agent-policy';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { AgentApplicationsRepository } from './agent-applications.repository';
import { ListAgentApplicationsDto } from './dto/list-agent-applications.dto';
import { ReviewApplicationDto } from './dto/review-application.dto';

@Injectable()
export class AgentApplicationsService {
  constructor(private readonly applications: AgentApplicationsRepository) {}

  list(query: ListAgentApplicationsDto) {
    return this.applications.list(query);
  }

  async get(id: string) {
    const dossier = await this.applications.findById(id);
    if (!dossier) throw new NotFoundException('Application not found');
    return dossier;
  }

  async claim(user: AuthenticatedUser, id: string) {
    const dossier = await this.get(id);
    if (!canClaimApplication(dossier)) throw new ConflictException('Application cannot be claimed');
    const claimed = await this.applications.claim(id, user.sub);
    if (!claimed) throw new ConflictException('Application is already assigned to another agent');
    return this.get(id);
  }

  async review(user: AuthenticatedUser, id: string, dto: ReviewApplicationDto) {
    const dossier = await this.get(id);
    if (!canReviewApplication(user, dossier, dto.statut)) {
      throw new ForbiddenException('Invalid transition or application not assigned to this agent');
    }
    const updated = await this.applications.transition(id, user.sub, dossier.statut, dto.statut, dto.commentaire.trim());
    if (!updated) throw new ConflictException('Application changed during review');
    return this.get(id);
  }
}
