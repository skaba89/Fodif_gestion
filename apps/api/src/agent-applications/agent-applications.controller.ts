import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { AgentApplicationsService } from './agent-applications.service';
import { ListAgentApplicationsDto } from './dto/list-agent-applications.dto';
import { ReviewApplicationDto } from './dto/review-application.dto';

interface AuthenticatedRequest extends Request { user: AuthenticatedUser }

@ApiTags('agent-applications')
@ApiBearerAuth()
@RequireRoles('AGENT_FODIP', 'SUPER_ADMIN')
@Controller('agent/applications')
export class AgentApplicationsController {
  constructor(private readonly applications: AgentApplicationsService) {}

  @Get()
  @RequirePermissions('application.read')
  list(@Query() query: ListAgentApplicationsDto) {
    return this.applications.list(query);
  }

  @Get(':id')
  @RequirePermissions('application.read')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.applications.get(id);
  }

  @Post(':id/claim')
  @RequirePermissions('application.review')
  claim(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.applications.claim(request.user, id);
  }

  @Post(':id/review')
  @RequirePermissions('application.review')
  review(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewApplicationDto,
  ) {
    return this.applications.review(request.user, id, dto);
  }
}
