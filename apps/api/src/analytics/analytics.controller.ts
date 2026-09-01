import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@RequireRoles('DIRECTION_FODIP', 'ANALYSTE', 'SUPER_ADMIN')
@RequirePermissions('dashboard.read')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('dashboard')
  dashboard(@Query() query: DashboardQueryDto) {
    return this.analytics.dashboard(query);
  }
}
