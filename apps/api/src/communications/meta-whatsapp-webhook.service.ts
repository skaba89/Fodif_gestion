import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommunicationsRepository } from './communications.repository';

interface MetaStatusPayload {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: Array<{ code?: number }>;
}

interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        statuses?: MetaStatusPayload[];
      };
    }>;
  }>;
}

export interface MetaWebhookSummary {
  received: number;
  updated: number;
  ignored: number;
}

@Injectable()
export class MetaWhatsAppWebhookService {
  constructor(
    private readonly config: ConfigService,
    private readonly communications: CommunicationsRepository,
  ) {}

  verifyChallenge(mode?: string, token?: string, challenge?: string): string | null {
    const expected = this.config.get<string>('WHATSAPP_META_VERIFY_TOKEN');
    if (!expected || mode !== 'subscribe' || token !== expected || !challenge) return null;
    return challenge;
  }

  verifySignature(rawBody: Buffer | undefined, signature?: string): boolean {
    const secret = this.config.get<string>('WHATSAPP_META_APP_SECRET');
    if (!secret || !rawBody || !signature?.startsWith('sha256=')) return false;

    const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    const actualBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (actualBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(actualBuffer, expectedBuffer);
  }

  async process(payload: MetaWebhookPayload): Promise<MetaWebhookSummary> {
    if (payload.object !== 'whatsapp_business_account') {
      return { received: 0, updated: 0, ignored: 0 };
    }

    const statuses: MetaStatusPayload[] = [];
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;
        statuses.push(...(change.value?.statuses ?? []));
      }
    }

    const summary: MetaWebhookSummary = { received: statuses.length, updated: 0, ignored: 0 };
    for (const item of statuses) {
      const providerMessageId = item.id;
      const status = this.mapStatus(item.status);
      const occurredAt = this.parseTimestamp(item.timestamp);
      if (!providerMessageId || !status || !occurredAt) {
        summary.ignored += 1;
        continue;
      }

      const rawErrorCode = item.errors?.[0]?.code;
      const errorCode = status === 'FAILED' && typeof rawErrorCode === 'number'
        ? `META_${rawErrorCode}`
        : undefined;
      const updated = await this.communications.applyProviderStatus(
        'meta',
        providerMessageId,
        status,
        occurredAt,
        errorCode,
      );
      if (updated) summary.updated += 1;
      else summary.ignored += 1;
    }
    return summary;
  }

  private mapStatus(status?: string): 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | null {
    switch (status) {
      case 'sent': return 'SENT';
      case 'delivered': return 'DELIVERED';
      case 'read': return 'READ';
      case 'failed': return 'FAILED';
      default: return null;
    }
  }

  private parseTimestamp(timestamp?: string): Date | null {
    if (!timestamp) return null;
    const seconds = Number(timestamp);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return new Date(seconds * 1000);
  }
}
