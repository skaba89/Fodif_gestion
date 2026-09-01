import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CommitteeService } from './committee.service';
import { CommitteeDecisionDto } from './dto/committee-decision.dto';

interface AuthenticatedRequest extends Request { user: AuthenticatedUser }

@ApiTags('committee')
@ApiBearerAuth()
@RequireRoles('COMITE_FINANCEMENT', 'SUPER_ADMIN')
@Controller('committee/applications')
export class CommitteeController {
  constructor(private readonly committee: CommitteeService) {}

  @Get()
  @RequirePermissions('application.read', 'scoring.read')
  list() {
    return this.committee.list();
  }

  @Get(':id')
  @RequirePermissions('application.read', 'scoring.read')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.committee.get(id);
  }

  @Post(':id/decision')
  @RequirePermissions('application.read', 'scoring.read', 'decision.create')
  decide(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CommitteeDecisionDto,
  ) {
    return this.committee.decide(request.user, id, dto);
  }
}
