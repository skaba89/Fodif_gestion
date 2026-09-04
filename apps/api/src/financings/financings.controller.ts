import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CreateFinancingDto } from './dto/create-financing.dto';
import { CreateRepaymentDto } from './dto/create-repayment.dto';
import { ExecuteDisbursementDto } from './dto/execute-disbursement.dto';
import { ListFinancingsDto } from './dto/list-financings.dto';
import { PlanDisbursementDto } from './dto/plan-disbursement.dto';
import { SaveImpactDto } from './dto/save-impact.dto';
import { FinancingsService } from './financings.service';

interface AuthenticatedRequest extends Request { user: AuthenticatedUser }

@ApiTags('financings')
@ApiBearerAuth()
// AUDITEUR has read-only financing/impact permissions (database/002_auth_rbac.sql) but no
// financing.manage/disbursement.manage/repayment.manage/impact.manage - the mutating handlers
// below stay closed to it on their own @RequirePermissions, same as ANALYSTE today.
@RequireRoles('DIRECTION_FODIP', 'ANALYSTE', 'AUDITEUR', 'SUPER_ADMIN')
@Controller('financings')
export class FinancingsController {
  constructor(private readonly financings: FinancingsService) {}

  @Get()
  @RequirePermissions('financing.read')
  list(@Query() query: ListFinancingsDto) { return this.financings.list(query); }

  @Get('eligible-applications')
  @RequirePermissions('financing.manage')
  listEligibleApplications() { return this.financings.listEligibleApplications(); }

  @Get(':id')
  @RequirePermissions('financing.read')
  get(@Param('id', new ParseUUIDPipe()) id: string) { return this.financings.get(id); }

  @Post('applications/:applicationId')
  @RequirePermissions('financing.manage')
  createFromApplication(
    @Req() request: AuthenticatedRequest,
    @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
    @Body() dto: CreateFinancingDto,
  ) { return this.financings.createFromApplication(request.user, applicationId, dto); }

  @Post(':id/disbursements')
  @RequirePermissions('disbursement.manage')
  planDisbursement(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PlanDisbursementDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) { return this.financings.planDisbursement(request.user, id, dto, idempotencyKey); }

  @Post(':id/disbursements/:disbursementId/execute')
  @RequirePermissions('disbursement.manage')
  executeDisbursement(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('disbursementId', new ParseUUIDPipe()) disbursementId: string,
    @Body() dto: ExecuteDisbursementDto,
  ) { return this.financings.executeDisbursement(request.user, id, disbursementId, dto); }

  @Post(':id/repayments')
  @RequirePermissions('repayment.manage')
  createRepayment(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateRepaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) { return this.financings.createRepayment(request.user, id, dto, idempotencyKey); }

  @Post(':id/impact')
  @RequirePermissions('impact.manage')
  saveImpact(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SaveImpactDto,
  ) { return this.financings.saveImpact(request.user, id, dto); }
}
