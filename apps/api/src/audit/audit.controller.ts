import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

/**
 * Read-only oversight endpoint for the AUDITEUR role (axe "tous les rôles doivent être
 * fonctionnels" - docs/01-SOCLE-FONCTIONNEL-INITIAL.md). audit_logs is written by every module (administration, agent
 * instruction, committee decisions, scoring, documents, financings) but was never exposed for
 * reading before this: the `audit.read` permission existed in the RBAC seed data since
 * database/002_auth_rbac.sql, but nothing ever checked it.
 */
@ApiTags('audit')
@ApiBearerAuth()
@RequireRoles('AUDITEUR', 'SUPER_ADMIN')
@Controller('audit/logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('audit.read')
  list(@Query() query: ListAuditLogsDto) {
    return this.audit.list(query);
  }
}
