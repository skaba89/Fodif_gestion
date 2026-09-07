import { ConfigService } from '@nestjs/config';
import { CommunicationsModule } from './communications.module';
import { DisabledWhatsAppProvider } from './disabled-whatsapp.provider';
import { MetaWhatsAppProvider } from './meta-whatsapp.provider';
import { WHATSAPP_PROVIDER, WhatsAppProvider } from './whatsapp-provider';

type ProviderDefinition = {
  provide: symbol;
  useFactory: (
    config: ConfigService,
    disabled: DisabledWhatsAppProvider,
    meta: MetaWhatsAppProvider,
  ) => WhatsAppProvider;
};

function whatsappProviderDefinition(): ProviderDefinition {
  const providers = Reflect.getMetadata('providers', CommunicationsModule) as unknown[];
  const definition = providers.find(
    (provider) =>
      typeof provider === 'object' &&
      provider !== null &&
      (provider as { provide?: unknown }).provide === WHATSAPP_PROVIDER,
  );
  if (!definition) throw new Error('WhatsApp provider definition not found');
  return definition as ProviderDefinition;
}

describe('CommunicationsModule WhatsApp provider selection', () => {
  const disabled = {} as DisabledWhatsAppProvider;
  const meta = { assertConfigured: jest.fn() } as unknown as MetaWhatsAppProvider;

  afterEach(() => jest.clearAllMocks());

  it('keeps WhatsApp disabled by default', () => {
    const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;

    expect(whatsappProviderDefinition().useFactory(config, disabled, meta)).toBe(disabled);
    expect(meta.assertConfigured).not.toHaveBeenCalled();
  });

  it('validates configuration before enabling the Meta provider', () => {
    const config = { get: jest.fn().mockReturnValue(' meta ') } as unknown as ConfigService;

    expect(whatsappProviderDefinition().useFactory(config, disabled, meta)).toBe(meta);
    expect(meta.assertConfigured).toHaveBeenCalledTimes(1);
  });

  it('fails closed for an unsupported provider', () => {
    const config = { get: jest.fn().mockReturnValue('unknown-provider') } as unknown as ConfigService;

    expect(() => whatsappProviderDefinition().useFactory(config, disabled, meta)).toThrow(
      'Unsupported WHATSAPP_PROVIDER: unknown-provider',
    );
  });
});
