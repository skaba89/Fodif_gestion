import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { CommunicationsRepository } from './communications.repository';
import { MetaWhatsAppWebhookService } from './meta-whatsapp-webhook.service';
import { WhatsAppInboundSupportService } from './whatsapp-inbound-support.service';

describe('MetaWhatsAppWebhookService', () => {
  let communications: jest.Mocked<CommunicationsRepository>;
  let inboundSupport: jest.Mocked<WhatsAppInboundSupportService>;
  let service: MetaWhatsAppWebhookService;

  beforeEach(() => {
    communications = {
      applyProviderStatus: jest.fn(),
    } as unknown as jest.Mocked<CommunicationsRepository>;
    inboundSupport = {
      handle: jest.fn(),
    } as unknown as jest.Mocked<WhatsAppInboundSupportService>;
    service = new MetaWhatsAppWebhookService(
      new ConfigService({
        WHATSAPP_META_APP_SECRET: 'unit-test-app-secret',
        WHATSAPP_META_VERIFY_TOKEN: 'unit-test-verify-token',
      }),
      communications,
      inboundSupport,
    );
  });

  it('verifies the Meta subscription challenge only with the configured token', () => {
    expect(service.verifyChallenge('subscribe', 'unit-test-verify-token', '12345')).toBe('12345');
    expect(service.verifyChallenge('subscribe', 'wrong', '12345')).toBeNull();
  });

  it('rejects non-numeric or oversized verification challenges before reflection', () => {
    expect(service.verifyChallenge('subscribe', 'unit-test-verify-token', '<script>alert(1)</script>')).toBeNull();
    expect(service.verifyChallenge('subscribe', 'unit-test-verify-token', '123abc')).toBeNull();
    expect(service.verifyChallenge('subscribe', 'unit-test-verify-token', '1'.repeat(33))).toBeNull();
  });

  it('validates x-hub-signature-256 against the exact raw body', () => {
    const rawBody = Buffer.from('{"object":"whatsapp_business_account"}', 'utf8');
    const signature = `sha256=${createHmac('sha256', 'unit-test-app-secret').update(rawBody).digest('hex')}`;

    expect(service.verifySignature(rawBody, signature)).toBe(true);
    expect(service.verifySignature(Buffer.from('{}'), signature)).toBe(false);
  });

  it('maps Meta delivery statuses to the operational delivery ledger', async () => {
    communications.applyProviderStatus.mockResolvedValue(true);

    await expect(service.process({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            statuses: [{
              id: 'wamid.test-1',
              status: 'delivered',
              timestamp: '1788796800',
            }],
          },
        }],
      }],
    })).resolves.toEqual({ received: 1, updated: 1, ignored: 0 });

    expect(communications.applyProviderStatus).toHaveBeenCalledWith(
      'meta',
      'wamid.test-1',
      'DELIVERED',
      new Date(1788796800 * 1000),
      undefined,
    );
  });

  it('forwards a delayed read event as the strongest semantic delivery state', async () => {
    communications.applyProviderStatus.mockResolvedValue(true);

    await expect(service.process({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            statuses: [{
              id: 'wamid.test-read',
              status: 'read',
              timestamp: '1788796700',
            }],
          },
        }],
      }],
    })).resolves.toEqual({ received: 1, updated: 1, ignored: 0 });

    expect(communications.applyProviderStatus).toHaveBeenCalledWith(
      'meta',
      'wamid.test-read',
      'READ',
      new Date(1788796700 * 1000),
      undefined,
    );
  });

  it('routes only inbound text messages to the support service', async () => {
    inboundSupport.handle.mockResolvedValue({
      processed: true,
      duplicate: false,
      replied: true,
      optedOut: false,
      humanHandoff: false,
    });

    await expect(service.process({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            messages: [
              {
                id: 'wamid.inbound-1',
                from: '224620000000',
                type: 'text',
                text: { body: 'Comment déposer une demande ?' },
              },
              {
                id: 'wamid.image-1',
                from: '224620000000',
                type: 'image',
              },
            ],
          },
        }],
      }],
    })).resolves.toEqual({ received: 0, updated: 0, ignored: 0 });

    expect(inboundSupport.handle).toHaveBeenCalledTimes(1);
    expect(inboundSupport.handle).toHaveBeenCalledWith({
      provider: 'meta',
      providerMessageId: 'wamid.inbound-1',
      from: '224620000000',
      text: 'Comment déposer une demande ?',
    });
  });

  it('ignores unsupported webhook payloads without invoking support', async () => {
    await expect(service.process({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'messages', value: {} }] }],
    })).resolves.toEqual({ received: 0, updated: 0, ignored: 0 });
    expect(communications.applyProviderStatus).not.toHaveBeenCalled();
    expect(inboundSupport.handle).not.toHaveBeenCalled();
  });
});
