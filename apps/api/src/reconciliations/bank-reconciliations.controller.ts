import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { BankReconciliationsService } from './bank-reconciliations.service';
import { CreateBankStatementEntryDto } from './dto/create-bank-statement-entry.dto';
import { ListBankReconciliationsDto } from './dto/list-bank-reconciliations.dto';
import { MatchBankStatementEntryDto } from './dto/match-bank-statement-entry.dto';

interface AuthenticatedRequest extends Request { user: AuthenticatedUser }

@ApiTags('bank-reconciliations')
@ApiBearerAuth()
@RequireRoles('DIRECTION_FODIP', 'ANALYSTE', 'AUDITEUR', 'SUPER_ADMIN')
@Controller('bank-reconciliations')
export class BankReconciliationsController {
  constructor(private readonly reconciliations: BankReconciliationsService) {}

  @Get()
  @RequirePermissions('reconciliation.read')
  overview(@Query() query: ListBankReconciliationsDto) {
    return this.reconciliations.overview(query);
  }

  @Post('entries')
  @RequirePermissions('reconciliation.manage')
  createEntry(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateBankStatementEntryDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.reconciliations.createEntry(request.user, dto, idempotencyKey);
  }

  @Post('entries/:id/match')
  @RequirePermissions('reconciliation.manage')
  matchEntry(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MatchBankStatementEntryDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.reconciliations.matchEntry(request.user, id, dto, idempotencyKey);
  }
}
