import { Module } from '@nestjs/common';
import { CommunicationsController } from './communications.controller';
import { CommunicationsRepository } from './communications.repository';
import { CommunicationsService } from './communications.service';
import { DisabledWhatsAppProvider } from './disabled-whatsapp.provider';
import { WHATSAPP_PROVIDER } from './whatsapp-provider';

@Module({
  controllers: [CommunicationsController],
  providers: [
    CommunicationsRepository,
    CommunicationsService,
    DisabledWhatsAppProvider,
    { provide: WHATSAPP_PROVIDER, useExisting: DisabledWhatsAppProvider },
  ],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
