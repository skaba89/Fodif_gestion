import { Injectable } from '@nestjs/common';
import { AuditRepository } from './audit.repository';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@Injectable()
export class AuditService {
  constructor(private readonly audit: AuditRepository) {}

  list(query: ListAuditLogsDto) {
    return this.audit.list(query);
  }
}
