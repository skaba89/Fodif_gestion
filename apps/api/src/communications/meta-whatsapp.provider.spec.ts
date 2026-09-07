import { ConfigService } from '@nestjs/config';
import { MetaWhatsAppProvider } from './meta-whatsapp.provider';

const configuredValues = {
  WHATSAPP_META_GRAPH_API_VERSION: 'v99.0',
  WHATSAPP_META_PHONE_NUMBER_ID: '123456789',
  WHATSAPP_META_ACCESS_TOKEN: 'test-token-not-a-secret',
  WHATSAPP_META_APP_SECRET: 'test-app-secret-not-a-secret',
  WHATSAPP_META_VERIFY_TOKEN: 'test-verify-token-not-a-secret',
  WHATSAPP_META_API_BASE_URL: 'https://graph.example.test',
  WHATSAPP_META_TEMPLATE_CATALOG_JSON: JSON.stringify({
    repayment_due_7d: {
      name: 'fodip_repayment_due_7d',
      languageCode: 'fr',
      variableOrder: ['reference', 'dueDate'],
    },
  }),
};

describe('MetaWhatsAppProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('fails closed when Meta configuration is incomplete', async () => {
    const provider = new MetaWhatsAppProvider(new ConfigService({}));

    await expect(provider.sendTemplate({
      to: '+224600000000',
      templateKey: 'repayment_due_7d',
    })).resolves.toEqual({
      accepted: false,
      provider: 'meta',
      errorCode: 'WHATSAPP_META_CONFIGURATION_INVALID',
    });
  });

  it('rejects an internal template key that is not mapped to an approved Meta template', async () => {
    const provider = new MetaWhatsAppProvider(new ConfigService(configuredValues));

    await expect(provider.sendTemplate({
      to: '+224600000000',
      templateKey: 'unknown_template',
    })).resolves.toEqual({
      accepted: false,
      provider: 'meta',
      errorCode: 'WHATSAPP_TEMPLATE_NOT_CONFIGURED',
    });
  });

  it('sends positional template variables in catalog order without persisting or logging them', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: 'wamid.test-1' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const provider = new MetaWhatsAppProvider(new ConfigService(configuredValues));

    await expect(provider.sendTemplate({
      to: '+224600000000',
      templateKey: 'repayment_due_7d',
      variables: { dueDate: '2026-09-14', reference: 'FIN-2026-000001' },
    })).resolves.toEqual({
      accepted: true,
      provider: 'meta',
      providerMessageId: 'wamid.test-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://graph.example.test/v99.0/123456789/messages');
    expect(options?.method).toBe('POST');
    expect(options?.headers).toMatchObject({
      Authorization: 'Bearer test-token-not-a-secret',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(options?.body))).toMatchObject({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '224600000000',
      type: 'template',
      template: {
        name: 'fodip_repayment_due_7d',
        language: { code: 'fr' },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: 'FIN-2026-000001' },
            { type: 'text', text: '2026-09-14' },
          ],
        }],
      },
    });
  });

  it('sends a bounded freeform text reply for a user-initiated support conversation', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: 'wamid.reply-1' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const provider = new MetaWhatsAppProvider(new ConfigService(configuredValues));

    await expect(provider.sendText({
      to: '+224600000000',
      text: 'Orientation FODIP sécurisée.',
    })).resolves.toEqual({
      accepted: true,
      provider: 'meta',
      providerMessageId: 'wamid.reply-1',
    });

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(options?.body))).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '224600000000',
      type: 'text',
      text: {
        preview_url: false,
        body: 'Orientation FODIP sécurisée.',
      },
    });
  });
});
