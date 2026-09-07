import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommunicationsController } from './communications.controller';
import { CommunicationsRepository } from './communications.repository';
import { CommunicationsService } from './communications.service';
import { DisabledWhatsAppProvider } from './disabled-whatsapp.provider';
import { MetaWhatsAppProvider } from './meta-whatsapp.provider';
import { MetaWhatsAppWebhookController } from './meta-whatsapp-webhook.controller';
import { MetaWhatsAppWebhookService } from './meta-whatsapp-webhook.service';
import { ReminderController } from './reminders/reminder.controller';
import { ReminderRepository } from './reminders/reminder.repository';
import { ReminderService } from './reminders/reminder.service';
import { SupportAssistantService } from './support/support-assistant.service';
import { SupportController } from './support/support.controller';
import { WHATSAPP_PROVIDER, WhatsAppProvider } from './whatsapp-provider';

@Module({
  controllers: [
    CommunicationsController,
    ReminderController,
    MetaWhatsAppWebhookController,
    SupportController,
  ],
  providers: [
    CommunicationsRepository,
    CommunicationsService,
    ReminderRepository,
    ReminderService,
    MetaWhatsAppWebhookService,
    SupportAssistantService,
    DisabledWhatsAppProvider,
    MetaWhatsAppProvider,
    {
      provide: WHATSAPP_PROVIDER,
      inject: [ConfigService, DisabledWhatsAppProvider, MetaWhatsAppProvider],
      useFactory: (
        config: ConfigService,
        disabled: DisabledWhatsAppProvider,
        meta: MetaWhatsAppProvider,
      ): WhatsAppProvider => {
        const selected = (config.get<string>('WHATSAPP_PROVIDER') ?? 'disabled')
          .trim()
          .toLowerCase();
        if (selected === 'disabled') return disabled;
        if (selected === 'meta') {
          meta.assertConfigured();
          return meta;
        }
        throw new Error(`Unsupported WHATSAPP_PROVIDER: ${selected}`);
      },
    },
  ],
  exports: [CommunicationsService, ReminderService, SupportAssistantService],
})
export class CommunicationsModule {}
