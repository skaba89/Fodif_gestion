import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { RequireRoles } from '../../common/decorators/roles.decorator';
import { ReminderService } from './reminder.service';

@ApiTags('communications')
@ApiBearerAuth()
@RequireRoles('SUPER_ADMIN')
@RequirePermissions('communications.reminders.run')
@Controller('communications/whatsapp/reminders')
export class ReminderController {
  constructor(private readonly reminders: ReminderService) {}

  @Post('run')
  run() {
    return this.reminders.runCurrent();
  }
}
