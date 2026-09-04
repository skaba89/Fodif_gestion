import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CreateRepaymentDto } from '../financings/dto/create-repayment.dto';
import { CreatePartnerDisbursementDto } from './dto/create-partner-disbursement.dto';
import { ListPartnerFinancingsDto } from './dto/list-partner-financings.dto';
import { PartnerService } from './partner.service';

interface AuthenticatedRequest extends Request { user: AuthenticatedUser }

/**
 * Axe D1 (docs/14-ROADMAP-SAAS-PREMIUM.md): API for institutional bank partners. Everything here
 * is scoped to the caller's own partenaire_bancaire_id (see PartnerService#partnerId) - a partner
 * never sees a financing outside its own correspondent-bank assignments or client portfolio (see
 * database/011_partner_banks.sql for the scoping model). Unlike Direction's own financing
 * endpoints, there is no creation or planning here: a partner only reads what FODIP already
 * decided and self-reports payments it already executed.
 */
// No SUPER_ADMIN here, unlike most other controllers: every route below is inherently scoped to
// the caller's own single partenaire_bancaire_id (PartnerService#partnerId), which a super-admin
// account does not and should not have - matching how PME's own self-service routes
// (applications/companies controllers) are PME-only for the same reason. An administrator manages
// partner banks and their assigned users via /administration instead.
@ApiTags('partner')
@ApiBearerAuth()
@RequireRoles('PARTENAIRE_BANCAIRE')
@Controller('partner/financings')
export class PartnerController {
  constructor(private readonly partner: PartnerService) {}

  @Get()
  @RequirePermissions('partner.application.read')
  list(@Req() request: AuthenticatedRequest, @Query() query: ListPartnerFinancingsDto) {
    return this.partner.list(request.user, query);
  }

  @Get(':id')
  @RequirePermissions('partner.application.read')
  get(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.partner.get(request.user, id);
  }

  @Post(':id/disbursements')
  @RequirePermissions('partner.disbursement.create')
  createDisbursement(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreatePartnerDisbursementDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.partner.createDisbursement(request.user, id, dto, idempotencyKey);
  }

  @Post(':id/repayments')
  @RequirePermissions('partner.repayment.create')
  createRepayment(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateRepaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.partner.createRepayment(request.user, id, dto, idempotencyKey);
  }
}
