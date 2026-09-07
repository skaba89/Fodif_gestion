import { Module } from '@nestjs/common';
import { CommunicationsModule } from '../communications.module';
import { ReminderSchedulerAuthService } from './reminder-scheduler-auth.service';
import { ReminderSchedulerController } from './reminder-scheduler.controller';

@Module({
  imports: [CommunicationsModule],
  controllers: [ReminderSchedulerController],
  providers: [ReminderSchedulerAuthService],
})
export class ReminderSchedulerModule {}
