import { Injectable } from '@nestjs/common';
import { CommunicationsRepository } from './communications.repository';
import { CommunicationsService } from './communications.service';
import { SupportAssistantService } from './support/support-assistant.service';

export interface InboundWhatsAppTextMessage {
  provider: string;
  providerMessageId: string;
  from: string;
  text: string;
}

export interface InboundWhatsAppSupportResult {
  processed: boolean;
  duplicate: boolean;
  replied: boolean;
  optedOut: boolean;
  humanHandoff: boolean;
}

const OPT_OUT_COMMANDS = new Set([
  'stop',
  'arreter',
  'desabonner',
  'desabonnement',
  'unsubscribe',
]);

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePhone(value: string): string | null {
  const digits = value.replace(/[^0-9]/g, '');
  if (!/^[1-9][0-9]{7,14}$/.test(digits)) return null;
  return `+${digits}`;
}

@Injectable()
export class WhatsAppInboundSupportService {
  constructor(
    private readonly repository: CommunicationsRepository,
    private readonly communications: CommunicationsService,
    private readonly assistant: SupportAssistantService,
  ) {}

  async handle(message: InboundWhatsAppTextMessage): Promise<InboundWhatsAppSupportResult> {
    const telephoneE164 = normalizePhone(message.from);
    const text = message.text.trim();
    if (!telephoneE164 || !message.providerMessageId || !text) {
      return this.result(false, false, false, false, false);
    }

    const preferences = await this.repository.findPreferencesByPhone(telephoneE164);
    const preference = preferences.length === 1 ? preferences[0] : undefined;
    const inboundMessageId = await this.repository.createInboundAttempt({
      userId: preference?.userId,
      preferenceId: preference?.id,
      telephoneE164,
      provider: message.provider,
      providerMessageId: message.providerMessageId,
      messageType: 'CHATBOT',
    });

    if (!inboundMessageId) {
      return this.result(false, true, false, false, false);
    }

    try {
      if (OPT_OUT_COMMANDS.has(normalizeText(text))) {
        await this.repository.optOutByPhone(telephoneE164, 'WHATSAPP_INBOUND');
        const reply = await this.communications.sendInboundSupportReply({
          telephoneE164,
          userId: preference?.userId,
          preferenceId: preference?.id,
          messageType: 'SUPPORT',
          text:
            'Les notifications WhatsApp FODIP associées à ce numéro sont désactivées. Vous pourrez les réactiver depuis votre espace sécurisé si vous le souhaitez.',
        });

        if (reply.sent !== true) {
          const reason = 'reason' in reply
            ? reply.reason
            : 'WHATSAPP_PROVIDER_REJECTED';
          await this.repository.markInboundFailed(inboundMessageId, reason);
          return this.result(true, false, false, true, false);
        }

        await this.repository.markInboundProcessed(inboundMessageId);
        return this.result(true, false, true, true, false);
      }

      const answer = this.assistant.answer(text.slice(0, 4096));
      const reply = await this.communications.sendInboundSupportReply({
        telephoneE164,
        userId: preference?.userId,
        preferenceId: preference?.id,
        messageType: answer.humanHandoff ? 'SUPPORT' : 'CHATBOT',
        text: answer.answer,
      });

      if (reply.sent !== true) {
        const reason = 'reason' in reply
          ? reply.reason
          : 'WHATSAPP_PROVIDER_REJECTED';
        await this.repository.markInboundFailed(inboundMessageId, reason);
        return this.result(true, false, false, false, answer.humanHandoff);
      }

      await this.repository.markInboundProcessed(inboundMessageId);
      return this.result(true, false, true, false, answer.humanHandoff);
    } catch {
      await this.repository.markInboundFailed(
        inboundMessageId,
        'WHATSAPP_INBOUND_PROCESSING_ERROR',
      );
      return this.result(true, false, false, false, false);
    }
  }

  private result(
    processed: boolean,
    duplicate: boolean,
    replied: boolean,
    optedOut: boolean,
    humanHandoff: boolean,
  ): InboundWhatsAppSupportResult {
    return { processed, duplicate, replied, optedOut, humanHandoff };
  }
}
