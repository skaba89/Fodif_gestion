import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentApplicationsRepository } from '../agent-applications/agent-applications.repository';
import { AuditRepository } from './audit.repository';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@Injectable()
export class AuditService {
  constructor(
    private readonly audit: AuditRepository,
    private readonly agentApplications: AgentApplicationsRepository,
  ) {}

  list(query: ListAuditLogsDto) {
    return this.audit.list(query);
  }

  // "drill-down dossier" (issue #142): unlike AgentApplicationsService#get, AUDITEUR is a global
  // read-only oversight role — it must see any dossier, not just ones assigned to the caller, so
  // this deliberately skips AgentApplicationsService's agent-ownership check (canRead) and reads
  // the repository directly.
  async dossier(id: string) {
    const dossier = await this.agentApplications.findById(id);
    if (!dossier) throw new NotFoundException('Dossier not found');
    const auditTrail = await this.audit.dossierAuditTrail(id);
    return { ...dossier, auditTrail };
  }
}
