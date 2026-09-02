import { Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { DataRightsService } from './data-rights.service';

interface AuthenticatedRequest extends Request { user: AuthenticatedUser }

/**
 * Axe B6 (docs/14-ROADMAP-SAAS-PREMIUM.md) - "droits des personnes" half of data retention/purge:
 * self-service export and admin-processed erasure on request. See database/012_data_rights.sql
 * for why the other half (automatic purge by retention duration) is deliberately not built here.
 */
@ApiTags('data-rights')
@ApiBearerAuth()
@Controller('data-rights')
export class DataRightsController {
  constructor(private readonly dataRights: DataRightsService) {}

  // No @RequireRoles/@RequirePermissions: every authenticated account, whatever its role, can
  // export its own data - see AuthorizationGuard's fallthrough for routes without either decorator.
  @Get('export')
  exportOwnData(@Req() request: AuthenticatedRequest) {
    return this.dataRights.exportOwnData(request.user);
  }

  // Erasure is admin-processed, not self-service: the app has no account self-registration or
  // deletion flow, so a request arrives out-of-band (support channel, formal letter...) and a
  // SUPER_ADMIN applies it here - the same operator who already provisions and deactivates accounts.
  @Post('users/:id/anonymize')
  @RequireRoles('SUPER_ADMIN')
  @RequirePermissions('user.manage')
  anonymize(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.dataRights.anonymizeUser(request.user.sub, id);
  }
}
