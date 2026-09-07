import { Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ReminderSchedulerAuthService } from './reminder-scheduler-auth.service';
import { ReminderService } from './reminder.service';

@ApiTags('communications')
@Public()
@Controller('communications/whatsapp/reminders')
export class ReminderSchedulerController {
  constructor(
    private readonly schedulerAuth: ReminderSchedulerAuthService,
    private readonly reminders: ReminderService,
  ) {}

  @Post('scheduled-run')
  run(
    @Headers('x-fodip-scheduler-timestamp') timestamp: string | undefined,
    @Headers('x-fodip-scheduler-signature') signature: string | undefined,
  ) {
    if (!this.schedulerAuth.verify(timestamp, signature)) {
      throw new UnauthorizedException('Invalid scheduler signature');
    }
    return this.reminders.runCurrent();
  }
}
