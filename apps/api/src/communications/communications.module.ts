import { Module } from '@nestjs/common';
import { CommunicationsController } from './communications.controller';
import { CommunicationsRepository } from './communications.repository';
import { CommunicationsService } from './communications.service';
import { DisabledWhatsAppProvider } from './disabled-whatsapp.provider';
import { ReminderController } from './reminders/reminder.controller';
import { ReminderRepository } from './reminders/reminder.repository';
import { ReminderService } from './reminders/reminder.service';
import { WHATSAPP_PROVIDER } from './whatsapp-provider';

@Module({
  controllers: [CommunicationsController, ReminderController],
  providers: [
    CommunicationsRepository,
    CommunicationsService,
    ReminderRepository,
    ReminderService,
    DisabledWhatsAppProvider,
    { provide: WHATSAPP_PROVIDER, useExisting: DisabledWhatsAppProvider },
  ],
  exports: [CommunicationsService, ReminderService],
})
export class CommunicationsModule {}
