import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import {
  REMINDER_SCHEDULER_SIGNATURE_CONTRACT,
  ReminderSchedulerAuthService,
} from './reminder-scheduler-auth.service';

describe('ReminderSchedulerAuthService', () => {
  const secret = 'unit-test-scheduler-secret-at-least-32-characters';
  let service: ReminderSchedulerAuthService;

  beforeEach(() => {
    service = new ReminderSchedulerAuthService(
      new ConfigService({ WHATSAPP_REMINDER_SCHEDULER_SECRET: secret }),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  function sign(timestamp: string): string {
    const canonical = `${timestamp}\n${REMINDER_SCHEDULER_SIGNATURE_CONTRACT.method}\n${REMINDER_SCHEDULER_SIGNATURE_CONTRACT.path}`;
    return `sha256=${createHmac('sha256', secret).update(canonical).digest('hex')}`;
  }

  it('accepts a valid current HMAC signature', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_788_796_800_000);
    const timestamp = '1788796800';

    expect(service.verify(timestamp, sign(timestamp))).toBe(true);
  });

  it('rejects a replay outside the five-minute clock window', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_788_797_101_000);
    const timestamp = '1788796800';

    expect(service.verify(timestamp, sign(timestamp))).toBe(false);
  });

  it('rejects a modified signature', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_788_796_800_000);
    const timestamp = '1788796800';
    const signature = sign(timestamp);

    expect(service.verify(timestamp, `${signature.slice(0, -1)}0`)).toBe(false);
  });

  it('fails closed when the scheduler secret is absent or too short', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_788_796_800_000);
    const missing = new ReminderSchedulerAuthService(new ConfigService({}));
    const short = new ReminderSchedulerAuthService(
      new ConfigService({ WHATSAPP_REMINDER_SCHEDULER_SECRET: 'too-short' }),
    );

    expect(missing.verify('1788796800', sign('1788796800'))).toBe(false);
    expect(short.verify('1788796800', sign('1788796800'))).toBe(false);
  });
});
