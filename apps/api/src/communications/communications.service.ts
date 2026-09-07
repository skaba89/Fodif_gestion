import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CommunicationsRepository } from './communications.repository';
import { WHATSAPP_PROVIDER, WhatsAppProvider } from './whatsapp-provider';

export type WhatsAppMessageType = 'REMINDER' | 'SUPPORT' | 'CHATBOT' | 'TRANSACTIONAL';

export interface SendWhatsAppTemplateInput {
  userId: string;
  messageType: WhatsAppMessageType;
  templateKey: string;
  variables?: Record<string, string>;
  contextType?: string;
  contextId?: string;
}

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly communications: CommunicationsRepository,
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsAppProvider,
  ) {}

  async getOwnPreference(userId: string) {
    const preference = await this.communications.getPreference(userId);
    if (preference) return preference;

    return {
      userId,
      telephoneE164: null,
      consentStatus: 'OPTED_OUT' as const,
      consentSource: null,
      consentedAt: null,
      optedOutAt: null,
      updatedAt: null,
    };
  }

  async updateOwnPreference(userId: string, consent: boolean, telephoneE164?: string) {
    if (consent) {
      if (!telephoneE164) {
        throw new BadRequestException('telephoneE164 is required to enable WhatsApp');
      }
      return this.communications.optIn(userId, telephoneE164, 'PORTAL');
    }

    const preference = await this.communications.optOut(userId, 'PORTAL');
    return preference ?? this.getOwnPreference(userId);
  }

  async sendTemplateToUser(input: SendWhatsAppTemplateInput) {
    const preference = await this.communications.getPreference(input.userId);

    if (!preference || preference.consentStatus !== 'OPTED_IN') {
      const messageId = await this.communications.createOutboundAttempt({
        userId: input.userId,
        preferenceId: preference?.id,
        telephoneE164: preference?.telephoneE164,
        messageType: input.messageType,
        templateKey: input.templateKey,
        contextType: input.contextType,
        contextId: input.contextId,
        status: 'SKIPPED',
        errorCode: 'WHATSAPP_OPT_IN_REQUIRED',
      });
      return { sent: false, messageId, reason: 'WHATSAPP_OPT_IN_REQUIRED' as const };
    }

    const messageId = await this.communications.createOutboundAttempt({
      userId: input.userId,
      preferenceId: preference.id,
      telephoneE164: preference.telephoneE164,
      messageType: input.messageType,
      templateKey: input.templateKey,
      contextType: input.contextType,
      contextId: input.contextId,
    });

    try {
      const result = await this.provider.sendTemplate({
        to: preference.telephoneE164,
        templateKey: input.templateKey,
        variables: input.variables,
      });

      if (!result.accepted) {
        const errorCode = result.errorCode ?? 'WHATSAPP_PROVIDER_REJECTED';
        await this.communications.markFailed(messageId, result.provider, errorCode);
        return { sent: false, messageId, reason: errorCode };
      }

      await this.communications.markSent(messageId, result.provider, result.providerMessageId);
      return {
        sent: true,
        messageId,
        providerMessageId: result.providerMessageId ?? null,
      };
    } catch {
      await this.communications.markFailed(
        messageId,
        'unknown',
        'WHATSAPP_PROVIDER_ERROR',
      );
      return { sent: false, messageId, reason: 'WHATSAPP_PROVIDER_ERROR' as const };
    }
  }
}
