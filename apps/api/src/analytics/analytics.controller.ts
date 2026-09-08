import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { MissingDocumentsAlertService } from './missing-documents-alert.service';

const ALERT_SEVERITY_ORDER = { critique: 0, attention: 1, info: 2 } as const;

@ApiTags('analytics')
@ApiBearerAuth()
@RequireRoles('DIRECTION_FODIP', 'ANALYSTE', 'SUPER_ADMIN')
@RequirePermissions('dashboard.read')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly missingDocuments: MissingDocumentsAlertService,
  ) {}

  @Get('dashboard')
  async dashboard(@Query() query: DashboardQueryDto) {
    const dashboard = await this.analytics.dashboard(query);
    const missingDocumentsAlert = await this.missingDocuments.build(query);
    if (!missingDocumentsAlert) return dashboard;

    const alerts = [...dashboard.alerts, missingDocumentsAlert].sort(
      (a, b) => ALERT_SEVERITY_ORDER[a.severite] - ALERT_SEVERITY_ORDER[b.severite],
    );
    return { ...dashboard, alerts };
  }
}
