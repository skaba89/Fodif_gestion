import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SCHEDULER_METHOD = 'POST';
const SCHEDULER_PATH = '/api/v1/communications/whatsapp/reminders/scheduled-run';
const MAX_CLOCK_SKEW_SECONDS = 300;

@Injectable()
export class ReminderSchedulerAuthService {
  constructor(private readonly config: ConfigService) {}

  verify(timestampHeader?: string, signatureHeader?: string): boolean {
    const secret = this.config.get<string>('WHATSAPP_REMINDER_SCHEDULER_SECRET')?.trim();
    if (!secret || secret.length < 32) return false;
    if (!timestampHeader || !/^\d{10}$/.test(timestampHeader)) return false;
    if (!signatureHeader || !/^sha256=[a-f0-9]{64}$/i.test(signatureHeader)) return false;

    const timestamp = Number(timestampHeader);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > MAX_CLOCK_SKEW_SECONDS) {
      return false;
    }

    const canonical = `${timestampHeader}\n${SCHEDULER_METHOD}\n${SCHEDULER_PATH}`;
    const expected = `sha256=${createHmac('sha256', secret).update(canonical).digest('hex')}`;
    const actualBuffer = Buffer.from(signatureHeader.toLowerCase(), 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  }
}

export const REMINDER_SCHEDULER_SIGNATURE_CONTRACT = {
  method: SCHEDULER_METHOD,
  path: SCHEDULER_PATH,
  maxClockSkewSeconds: MAX_CLOCK_SKEW_SECONDS,
} as const;
