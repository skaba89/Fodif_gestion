import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WhatsAppProvider,
  WhatsAppSendResult,
  WhatsAppTemplateRequest,
  WhatsAppTextRequest,
} from './whatsapp-provider';

interface MetaTemplateDefinition {
  name: string;
  languageCode: string;
  variableOrder: string[];
}

type MetaTemplateCatalog = Record<string, MetaTemplateDefinition>;

interface MetaSendResponse {
  messages?: Array<{ id?: string }>;
}

@Injectable()
export class MetaWhatsAppProvider implements WhatsAppProvider {
  constructor(private readonly config: ConfigService) {}

  assertConfigured(): void {
    this.required('WHATSAPP_META_GRAPH_API_VERSION');
    this.required('WHATSAPP_META_PHONE_NUMBER_ID');
    this.required('WHATSAPP_META_ACCESS_TOKEN');
    this.required('WHATSAPP_META_APP_SECRET');
    this.required('WHATSAPP_META_VERIFY_TOKEN');
    this.templateCatalog();
  }

  async sendTemplate(request: WhatsAppTemplateRequest): Promise<WhatsAppSendResult> {
    let catalog: MetaTemplateCatalog;
    try {
      this.assertConfigured();
      catalog = this.templateCatalog();
    } catch {
      return this.configurationError();
    }

    const template = catalog[request.templateKey];
    if (!template) {
      return {
        accepted: false,
        provider: 'meta',
        errorCode: 'WHATSAPP_TEMPLATE_NOT_CONFIGURED',
      };
    }

    const variables = request.variables ?? {};
    const parameters: Array<{ type: 'text'; text: string }> = [];
    for (const key of template.variableOrder) {
      const value = variables[key];
      if (typeof value !== 'string' || value.trim().length === 0) {
        return {
          accepted: false,
          provider: 'meta',
          errorCode: 'WHATSAPP_TEMPLATE_VARIABLE_MISSING',
        };
      }
      parameters.push({ type: 'text', text: value.slice(0, 1024) });
    }

    return this.postMessage({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: request.to.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: template.name,
        language: { code: template.languageCode },
        ...(parameters.length > 0
          ? { components: [{ type: 'body', parameters }] }
          : {}),
      },
    });
  }

  async sendText(request: WhatsAppTextRequest): Promise<WhatsAppSendResult> {
    try {
      this.assertConfigured();
    } catch {
      return this.configurationError();
    }

    const text = request.text.trim();
    if (!text) {
      return {
        accepted: false,
        provider: 'meta',
        errorCode: 'WHATSAPP_TEXT_EMPTY',
      };
    }

    return this.postMessage({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: request.to.replace(/^\+/, ''),
      type: 'text',
      text: {
        preview_url: false,
        body: text.slice(0, 4096),
      },
    });
  }

  private async postMessage(body: unknown): Promise<WhatsAppSendResult> {
    let version: string;
    let phoneNumberId: string;
    let accessToken: string;
    try {
      version = this.required('WHATSAPP_META_GRAPH_API_VERSION');
      phoneNumberId = this.required('WHATSAPP_META_PHONE_NUMBER_ID');
      accessToken = this.required('WHATSAPP_META_ACCESS_TOKEN');
    } catch {
      return this.configurationError();
    }

    const apiBaseUrl = (this.config.get<string>('WHATSAPP_META_API_BASE_URL') ?? 'https://graph.facebook.com')
      .replace(/\/$/, '');

    try {
      const response = await fetch(`${apiBaseUrl}/${version}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        return {
          accepted: false,
          provider: 'meta',
          errorCode: `WHATSAPP_META_HTTP_${response.status}`,
        };
      }

      const payload = (await response.json()) as MetaSendResponse;
      const providerMessageId = payload.messages?.[0]?.id;
      if (!providerMessageId) {
        return {
          accepted: false,
          provider: 'meta',
          errorCode: 'WHATSAPP_META_INVALID_RESPONSE',
        };
      }

      return {
        accepted: true,
        provider: 'meta',
        providerMessageId,
      };
    } catch {
      return {
        accepted: false,
        provider: 'meta',
        errorCode: 'WHATSAPP_META_NETWORK_ERROR',
      };
    }
  }

  private configurationError(): WhatsAppSendResult {
    return {
      accepted: false,
      provider: 'meta',
      errorCode: 'WHATSAPP_META_CONFIGURATION_INVALID',
    };
  }

  private templateCatalog(): MetaTemplateCatalog {
    const raw = this.required('WHATSAPP_META_TEMPLATE_CATALOG_JSON');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('WHATSAPP_META_TEMPLATE_CATALOG_JSON must be valid JSON');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('WHATSAPP_META_TEMPLATE_CATALOG_JSON must be an object');
    }

    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Invalid WhatsApp template definition: ${key}`);
      }
      const candidate = value as Partial<MetaTemplateDefinition>;
      if (
        typeof candidate.name !== 'string' || candidate.name.length === 0 ||
        typeof candidate.languageCode !== 'string' || candidate.languageCode.length === 0 ||
        !Array.isArray(candidate.variableOrder) ||
        candidate.variableOrder.some((item) => typeof item !== 'string' || item.length === 0)
      ) {
        throw new Error(`Invalid WhatsApp template definition: ${key}`);
      }
    }
    return parsed as MetaTemplateCatalog;
  }

  private required(key: string): string {
    const value = this.config.get<string>(key)?.trim();
    if (!value) throw new Error(`${key} is required`);
    return value;
  }
}
