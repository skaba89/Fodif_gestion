import { CommunicationsService } from '../communications.service';
import { ReminderCandidate, ReminderRepository } from './reminder.repository';
import { ReminderService } from './reminder.service';

describe('ReminderService', () => {
  let repository: jest.Mocked<ReminderRepository>;
  let communications: jest.Mocked<CommunicationsService>;
  let service: ReminderService;

  const candidate: ReminderCandidate = {
    userId: '11111111-1111-4111-8111-111111111111',
    ruleKey: 'REPAYMENT_DUE_J7',
    templateKey: 'repayment_due_7d',
    contextType: 'ECHEANCE',
    contextId: '22222222-2222-4222-8222-222222222222',
    scheduledFor: '2026-09-07',
    reference: 'FIN-2026-000001',
    dueDate: '2026-09-14',
  };

  beforeEach(() => {
    repository = {
      quarantineStaleClaims: jest.fn().mockResolvedValue(0),
      listCandidates: jest.fn(),
      claim: jest.fn(),
      markSent: jest.fn(),
      markFailed: jest.fn(),
    } as unknown as jest.Mocked<ReminderRepository>;
    communications = {
      sendTemplateToUser: jest.fn(),
    } as unknown as jest.Mocked<CommunicationsService>;
    service = new ReminderService(repository, communications);
  });

  it('runs the current reminder batch through the date-safe entrypoint', async () => {
    repository.listCandidates.mockResolvedValue([]);

    await expect(service.runCurrent()).resolves.toEqual({
      discovered: 0,
      claimed: 0,
      sent: 0,
      failed: 0,
      deduplicated: 0,
      reviewRequired: 0,
    });
    expect(repository.listCandidates).toHaveBeenCalledWith(undefined);
  });

  it('deduplicates a reminder occurrence before calling the provider layer', async () => {
    repository.listCandidates.mockResolvedValue([candidate]);
    repository.claim.mockResolvedValue(null);

    await expect(service.runForDate('2026-09-07')).resolves.toEqual({
      discovered: 1,
      claimed: 0,
      sent: 0,
      failed: 0,
      deduplicated: 1,
      reviewRequired: 0,
    });
    expect(communications.sendTemplateToUser).not.toHaveBeenCalled();
  });

  it('sends only minimal template variables and records success', async () => {
    repository.listCandidates.mockResolvedValue([candidate]);
    repository.claim.mockResolvedValue('33333333-3333-4333-8333-333333333333');
    communications.sendTemplateToUser.mockResolvedValue({
      sent: true,
      messageId: '44444444-4444-4444-8444-444444444444',
      providerMessageId: 'provider-1',
    });

    await expect(service.runForDate('2026-09-07')).resolves.toEqual({
      discovered: 1,
      claimed: 1,
      sent: 1,
      failed: 0,
      deduplicated: 0,
      reviewRequired: 0,
    });
    expect(communications.sendTemplateToUser).toHaveBeenCalledWith({
      userId: candidate.userId,
      messageType: 'REMINDER',
      templateKey: 'repayment_due_7d',
      variables: {
        reference: 'FIN-2026-000001',
        dueDate: '2026-09-14',
      },
      contextType: 'ECHEANCE',
      contextId: candidate.contextId,
    });
    expect(repository.markSent).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
    );
  });

  it('keeps a failed occurrence retryable instead of marking it sent', async () => {
    repository.listCandidates.mockResolvedValue([candidate]);
    repository.claim.mockResolvedValue('33333333-3333-4333-8333-333333333333');
    communications.sendTemplateToUser.mockResolvedValue({
      sent: false,
      messageId: '44444444-4444-4444-8444-444444444444',
      reason: 'WHATSAPP_PROVIDER_NOT_CONFIGURED',
    });

    await expect(service.runForDate('2026-09-07')).resolves.toEqual({
      discovered: 1,
      claimed: 1,
      sent: 0,
      failed: 1,
      deduplicated: 0,
      reviewRequired: 0,
    });
    expect(repository.markFailed).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      'WHATSAPP_PROVIDER_NOT_CONFIGURED',
    );
  });

  it('surfaces stale ambiguous claims for review instead of replaying them', async () => {
    repository.quarantineStaleClaims.mockResolvedValue(2);
    repository.listCandidates.mockResolvedValue([]);

    await expect(service.runForDate('2026-09-07')).resolves.toEqual({
      discovered: 0,
      claimed: 0,
      sent: 0,
      failed: 0,
      deduplicated: 0,
      reviewRequired: 2,
    });
    expect(communications.sendTemplateToUser).not.toHaveBeenCalled();
  });
});
