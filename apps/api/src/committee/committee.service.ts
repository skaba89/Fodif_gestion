import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { validateCommitteeDecision } from '../committee-policy';
import { CommitteeRepository } from './committee.repository';
import { CommitteeDecisionDto } from './dto/committee-decision.dto';

@Injectable()
export class CommitteeService {
  constructor(private readonly committee: CommitteeRepository) {}

  list() {
    return this.committee.list();
  }

  async get(id: string) {
    const application = await this.committee.findById(id);
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  async decide(user: AuthenticatedUser, id: string, dto: CommitteeDecisionDto) {
    const application = await this.get(id);
    if (application.statut !== 'PRET_COMITE') throw new ConflictException('Application is not ready for committee');
    if (!application.score) throw new ConflictException('A complete score is required for committee review');
    const error = validateCommitteeDecision(dto, application.montantDemande);
    if (error) throw new BadRequestException(error);
    const updated = await this.committee.decide(id, user.sub, dto);
    if (!updated) throw new ConflictException('Application changed before committee decision');
    return this.get(id);
  }
}
