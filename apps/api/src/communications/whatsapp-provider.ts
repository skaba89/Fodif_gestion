export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');

export interface WhatsAppTemplateRequest {
  to: string;
  templateKey: string;
  variables?: Record<string, string>;
}

export interface WhatsAppTextRequest {
  to: string;
  text: string;
}

export interface WhatsAppSendResult {
  accepted: boolean;
  provider: string;
  providerMessageId?: string;
  errorCode?: string;
}

export interface WhatsAppProvider {
  sendTemplate(request: WhatsAppTemplateRequest): Promise<WhatsAppSendResult>;
  sendText(request: WhatsAppTextRequest): Promise<WhatsAppSendResult>;
}
