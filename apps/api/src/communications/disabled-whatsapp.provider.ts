import { Injectable } from '@nestjs/common';
import {
  WhatsAppProvider,
  WhatsAppSendResult,
  WhatsAppTemplateRequest,
  WhatsAppTextRequest,
} from './whatsapp-provider';

@Injectable()
export class DisabledWhatsAppProvider implements WhatsAppProvider {
  async sendTemplate(_request: WhatsAppTemplateRequest): Promise<WhatsAppSendResult> {
    return this.disabled();
  }

  async sendText(_request: WhatsAppTextRequest): Promise<WhatsAppSendResult> {
    return this.disabled();
  }

  private disabled(): WhatsAppSendResult {
    return {
      accepted: false,
      provider: 'disabled',
      errorCode: 'WHATSAPP_PROVIDER_NOT_CONFIGURED',
    };
  }
}
