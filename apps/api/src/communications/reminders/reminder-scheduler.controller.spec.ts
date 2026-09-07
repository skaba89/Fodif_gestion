import { UnauthorizedException } from '@nestjs/common';
import { ReminderSchedulerAuthService } from './reminder-scheduler-auth.service';
import { ReminderSchedulerController } from './reminder-scheduler.controller';
import { ReminderService } from './reminder.service';

describe('ReminderSchedulerController', () => {
  let schedulerAuth: jest.Mocked<ReminderSchedulerAuthService>;
  let reminders: jest.Mocked<ReminderService>;
  let controller: ReminderSchedulerController;

  beforeEach(() => {
    schedulerAuth = { verify: jest.fn() } as unknown as jest.Mocked<ReminderSchedulerAuthService>;
    reminders = { runCurrent: jest.fn() } as unknown as jest.Mocked<ReminderService>;
    controller = new ReminderSchedulerController(schedulerAuth, reminders);
  });

  it('rejects the machine trigger when the HMAC signature is invalid', () => {
    schedulerAuth.verify.mockReturnValue(false);

    expect(() => controller.run('1788796800', 'sha256=invalid')).toThrow(UnauthorizedException);
    expect(reminders.runCurrent).not.toHaveBeenCalled();
  });

  it('runs the current reminder batch once when the HMAC signature is valid', async () => {
    schedulerAuth.verify.mockReturnValue(true);
    reminders.runCurrent.mockResolvedValue({
      discovered: 1,
      claimed: 1,
      sent: 1,
      failed: 0,
      deduplicated: 0,
      reviewRequired: 0,
    });

    await expect(controller.run('1788796800', `sha256=${'a'.repeat(64)}`)).resolves.toEqual({
      discovered: 1,
      claimed: 1,
      sent: 1,
      failed: 0,
      deduplicated: 0,
      reviewRequired: 0,
    });
    expect(schedulerAuth.verify).toHaveBeenCalledTimes(1);
    expect(reminders.runCurrent).toHaveBeenCalledTimes(1);
  });
});
