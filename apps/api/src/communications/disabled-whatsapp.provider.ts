import { Injectable } from '@nestjs/common';
import {
  WhatsAppProvider,
  WhatsAppSendResult,
  WhatsAppTemplateRequest,
} from './whatsapp-provider';

@Injectable()
export class DisabledWhatsAppProvider implements WhatsAppProvider {
  async sendTemplate(_request: WhatsAppTemplateRequest): Promise<WhatsAppSendResult> {
    return {
      accepted: false,
      provider: 'disabled',
      errorCode: 'WHATSAPP_PROVIDER_NOT_CONFIGURED',
    };
  }
}
