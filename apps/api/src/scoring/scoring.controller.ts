import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { SaveScoreDto } from './dto/save-score.dto';
import { ScoringService } from './scoring.service';

interface AuthenticatedRequest extends Request { user: AuthenticatedUser }

@ApiTags('scoring')
@ApiBearerAuth()
@RequireRoles('AGENT_FODIP', 'SUPER_ADMIN')
@Controller('scoring/applications')
export class ScoringController {
  constructor(private readonly scoring: ScoringService) {}

  @Get(':id')
  @RequirePermissions('application.read', 'scoring.read')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.scoring.get(id);
  }

  @Put(':id')
  @RequirePermissions('application.review', 'scoring.calculate')
  calculate(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SaveScoreDto,
  ) {
    return this.scoring.calculate(request.user, id, dto);
  }
}
