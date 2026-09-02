import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { NotificationsService } from './notifications.service';

interface AuthenticatedRequest extends Request { user: AuthenticatedUser }

@ApiTags('notifications')
@ApiBearerAuth()
@RequirePermissions('notification.read')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query('unreadOnly') unreadOnly?: string) {
    return this.notifications.listOwn(request.user.sub, unreadOnly === 'true');
  }

  @Patch('read-all')
  markAllRead(@Req() request: AuthenticatedRequest) {
    return this.notifications.markAllRead(request.user.sub);
  }

  @Patch(':id/read')
  markRead(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.notifications.markRead(request.user.sub, id);
  }
}

