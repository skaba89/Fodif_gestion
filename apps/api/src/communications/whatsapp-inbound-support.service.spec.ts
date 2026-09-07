import { CommunicationsRepository, WhatsAppPreference } from './communications.repository';
import { CommunicationsService } from './communications.service';
import { SupportAssistantService } from './support/support-assistant.service';
import { WhatsAppInboundSupportService } from './whatsapp-inbound-support.service';

describe('WhatsAppInboundSupportService', () => {
  let repository: jest.Mocked<CommunicationsRepository>;
  let communications: jest.Mocked<CommunicationsService>;
  let assistant: SupportAssistantService;
  let service: WhatsAppInboundSupportService;

  const preference: WhatsAppPreference = {
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
      findPreferencesByPhone: jest.fn(),
      createInboundAttempt: jest.fn(),
      optOutByPhone: jest.fn(),
      markInboundProcessed: jest.fn(),
      markInboundFailed: jest.fn(),
    } as unknown as jest.Mocked<CommunicationsRepository>;
    communications = {
      sendInboundSupportReply: jest.fn(),
    } as unknown as jest.Mocked<CommunicationsService>;
    assistant = new SupportAssistantService();
    service = new WhatsAppInboundSupportService(repository, communications, assistant);
  });

  it('deduplicates the same Meta provider message before answering', async () => {
    repository.findPreferencesByPhone.mockResolvedValue([preference]);
    repository.createInboundAttempt.mockResolvedValue(null);

    await expect(service.handle({
      provider: 'meta',
      providerMessageId: 'wamid.inbound-1',
      from: '224620000000',
      text: 'Comment déposer une demande ?',
    })).resolves.toEqual({
      processed: false,
      duplicate: true,
      replied: false,
      optedOut: false,
      humanHandoff: false,
    });

    expect(communications.sendInboundSupportReply).not.toHaveBeenCalled();
  });

  it('answers general guidance without reading account data', async () => {
    repository.findPreferencesByPhone.mockResolvedValue([preference]);
    repository.createInboundAttempt.mockResolvedValue(
      '33333333-3333-4333-8333-333333333333',
    );
    communications.sendInboundSupportReply.mockResolvedValue({
      sent: true,
      messageId: '44444444-4444-4444-8444-444444444444',
      providerMessageId: 'wamid.reply-1',
    });

    await expect(service.handle({
      provider: 'meta',
      providerMessageId: 'wamid.inbound-2',
      from: '224620000000',
      text: 'Comment déposer une demande ?',
    })).resolves.toEqual({
      processed: true,
      duplicate: false,
      replied: true,
      optedOut: false,
      humanHandoff: false,
    });

    expect(communications.sendInboundSupportReply).toHaveBeenCalledWith(
      expect.objectContaining({
        telephoneE164: '+224620000000',
        userId: preference.userId,
        preferenceId: preference.id,
        messageType: 'CHATBOT',
      }),
    );
    expect(repository.markInboundProcessed).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333',
    );
  });

  it('protects account-specific questions and flags human handoff', async () => {
    repository.findPreferencesByPhone.mockResolvedValue([preference]);
    repository.createInboundAttempt.mockResolvedValue(
      '55555555-5555-4555-8555-555555555555',
    );
    communications.sendInboundSupportReply.mockResolvedValue({
      sent: true,
      messageId: '66666666-6666-4666-8666-666666666666',
      providerMessageId: 'wamid.reply-2',
    });

    const result = await service.handle({
      provider: 'meta',
      providerMessageId: 'wamid.inbound-3',
      from: '224620000000',
      text: 'Où en est mon dossier ?',
    });

    expect(result.humanHandoff).toBe(true);
    expect(communications.sendInboundSupportReply).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: 'SUPPORT',
        text: expect.stringContaining('je ne révèle pas ici le contenu'),
      }),
    );
  });

  it('honors STOP immediately and does not call the assistant', async () => {
    repository.findPreferencesByPhone.mockResolvedValue([preference]);
    repository.createInboundAttempt.mockResolvedValue(
      '77777777-7777-4777-8777-777777777777',
    );
    repository.optOutByPhone.mockResolvedValue(1);
    communications.sendInboundSupportReply.mockResolvedValue({
      sent: true,
      messageId: '88888888-8888-4888-8888-888888888888',
      providerMessageId: 'wamid.reply-stop',
    });
    const answerSpy = jest.spyOn(assistant, 'answer');

    await expect(service.handle({
      provider: 'meta',
      providerMessageId: 'wamid.inbound-stop',
      from: '+224 620 000 000',
      text: 'Désabonnement',
    })).resolves.toEqual({
      processed: true,
      duplicate: false,
      replied: true,
      optedOut: true,
      humanHandoff: false,
    });

    expect(repository.optOutByPhone).toHaveBeenCalledWith(
      '+224620000000',
      'WHATSAPP_INBOUND',
    );
    expect(answerSpy).not.toHaveBeenCalled();
  });

  it('marks the inbound receipt failed when the provider cannot answer', async () => {
    repository.findPreferencesByPhone.mockResolvedValue([]);
    repository.createInboundAttempt.mockResolvedValue(
      '99999999-9999-4999-8999-999999999999',
    );
    communications.sendInboundSupportReply.mockResolvedValue({
      sent: false,
      messageId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      reason: 'WHATSAPP_PROVIDER_NOT_CONFIGURED',
    });

    const result = await service.handle({
      provider: 'meta',
      providerMessageId: 'wamid.inbound-unknown',
      from: '224621111111',
      text: 'Quels programmes sont disponibles ?',
    });

    expect(result.replied).toBe(false);
    expect(repository.markInboundFailed).toHaveBeenCalledWith(
      '99999999-9999-4999-8999-999999999999',
      'WHATSAPP_PROVIDER_NOT_CONFIGURED',
    );
  });
});
