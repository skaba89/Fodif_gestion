import { BadRequestException } from '@nestjs/common';
import { CommunicationsRepository, WhatsAppPreference } from './communications.repository';
import { CommunicationsService } from './communications.service';
import { WhatsAppProvider } from './whatsapp-provider';

describe('CommunicationsService', () => {
  let repository: jest.Mocked<CommunicationsRepository>;
  let provider: jest.Mocked<WhatsAppProvider>;
  let service: CommunicationsService;

  const optedInPreference: WhatsAppPreference = {
    id: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    telephoneE164: '+224620000000',
    consentStatus: 'OPTED_IN',
    consentSource: 'PORTAL',
    consentedAt: new Date('2026-09-07T10:00:00.000Z'),
    optedOutAt: null,
    updatedAt: new Date('2026-09-07T10:00:00.000Z'),
  };

  beforeEach(() => {
    repository = {
      getPreference: jest.fn(),
      optIn: jest.fn(),
      optOut: jest.fn(),
      createOutboundAttempt: jest.fn(),
      markSent: jest.fn(),
      markFailed: jest.fn(),
    } as unknown as jest.Mocked<CommunicationsRepository>;

    provider = {
      sendTemplate: jest.fn(),
      sendText: jest.fn(),
    };

    service = new CommunicationsService(repository, provider);
  });

  it('requires an explicit E.164 number when enabling WhatsApp', async () => {
    await expect(
      service.updateOwnPreference(optedInPreference.userId, true),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.optIn).not.toHaveBeenCalled();
  });

  it('blocks and audits delivery when the user has not opted in', async () => {
    repository.getPreference.mockResolvedValue(null);
    repository.createOutboundAttempt.mockResolvedValue(
      '33333333-3333-4333-8333-333333333333',
    );

    const result = await service.sendTemplateToUser({
      userId: optedInPreference.userId,
      messageType: 'REMINDER',
      templateKey: 'dossier_document_manquant',
    });

    expect(result).toEqual({
      sent: false,
      messageId: '33333333-3333-4333-8333-333333333333',
      reason: 'WHATSAPP_OPT_IN_REQUIRED',
    });
    expect(repository.createOutboundAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'SKIPPED',
        errorCode: 'WHATSAPP_OPT_IN_REQUIRED',
      }),
    );
    expect(provider.sendTemplate).not.toHaveBeenCalled();
  });

  it('fails safely when no external WhatsApp provider is configured', async () => {
    repository.getPreference.mockResolvedValue(optedInPreference);
    repository.createOutboundAttempt.mockResolvedValue(
      '44444444-4444-4444-8444-444444444444',
    );
    provider.sendTemplate.mockResolvedValue({
      accepted: false,
      provider: 'disabled',
      errorCode: 'WHATSAPP_PROVIDER_NOT_CONFIGURED',
    });

    const result = await service.sendTemplateToUser({
      userId: optedInPreference.userId,
      messageType: 'SUPPORT',
      templateKey: 'support_orientation',
      variables: { firstName: 'Aminata' },
    });

    expect(result).toEqual({
      sent: false,
      messageId: '44444444-4444-4444-8444-444444444444',
      reason: 'WHATSAPP_PROVIDER_NOT_CONFIGURED',
    });
    expect(repository.markFailed).toHaveBeenCalledWith(
      '44444444-4444-4444-8444-444444444444',
      'disabled',
      'WHATSAPP_PROVIDER_NOT_CONFIGURED',
    );
  });

  it('marks an accepted provider delivery as sent', async () => {
    repository.getPreference.mockResolvedValue(optedInPreference);
    repository.createOutboundAttempt.mockResolvedValue(
      '55555555-5555-4555-8555-555555555555',
    );
    provider.sendTemplate.mockResolvedValue({
      accepted: true,
      provider: 'partner',
      providerMessageId: 'provider-message-1',
    });

    const result = await service.sendTemplateToUser({
      userId: optedInPreference.userId,
      messageType: 'TRANSACTIONAL',
      templateKey: 'dossier_statut',
    });

    expect(result).toEqual({
      sent: true,
      messageId: '55555555-5555-4555-8555-555555555555',
      providerMessageId: 'provider-message-1',
    });
    expect(repository.markSent).toHaveBeenCalledWith(
      '55555555-5555-4555-8555-555555555555',
      'partner',
      'provider-message-1',
    );
  });

  it('sends a freeform reply only through the internal inbound support path', async () => {
    repository.createOutboundAttempt.mockResolvedValue(
      '66666666-6666-4666-8666-666666666666',
    );
    provider.sendText.mockResolvedValue({
      accepted: true,
      provider: 'meta',
      providerMessageId: 'wamid.reply-1',
    });

    const result = await service.sendInboundSupportReply({
      telephoneE164: '+224620000000',
      userId: optedInPreference.userId,
      preferenceId: optedInPreference.id,
      text: 'Réponse institutionnelle de support.',
    });

    expect(result).toEqual({
      sent: true,
      messageId: '66666666-6666-4666-8666-666666666666',
      providerMessageId: 'wamid.reply-1',
    });
    expect(repository.getPreference).not.toHaveBeenCalled();
    expect(repository.createOutboundAttempt).toHaveBeenCalledWith({
      userId: optedInPreference.userId,
      preferenceId: optedInPreference.id,
      telephoneE164: '+224620000000',
      messageType: 'CHATBOT',
    });
    expect(provider.sendText).toHaveBeenCalledWith({
      to: '+224620000000',
      text: 'Réponse institutionnelle de support.',
    });
  });
});
