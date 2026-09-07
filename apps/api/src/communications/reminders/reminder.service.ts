import { Injectable } from '@nestjs/common';
import { CommunicationsService } from '../communications.service';
import { ReminderCandidate, ReminderRepository } from './reminder.repository';

export interface ReminderRunSummary {
  discovered: number;
  claimed: number;
  sent: number;
  failed: number;
  deduplicated: number;
  reviewRequired: number;
}

@Injectable()
export class ReminderService {
  constructor(
    private readonly reminders: ReminderRepository,
    private readonly communications: CommunicationsService,
  ) {}

  async runCurrent(): Promise<ReminderRunSummary> {
    return this.runForDate();
  }

  /** Internal date override exists for deterministic tests/backfills; HTTP never exposes it. */
  async runForDate(referenceDate?: string): Promise<ReminderRunSummary> {
    // A process may die after claiming an occurrence but before persisting the external provider
    // outcome. Automatically replaying that ambiguous occurrence could duplicate a WhatsApp
    // message, so stale claims are quarantined for review rather than retried blindly.
    const reviewRequired = await this.reminders.quarantineStaleClaims();
    const candidates = await this.reminders.listCandidates(referenceDate);
    const summary: ReminderRunSummary = {
      discovered: candidates.length,
      claimed: 0,
      sent: 0,
      failed: 0,
      deduplicated: 0,
      reviewRequired,
    };

    for (const candidate of candidates) {
      const dispatchId = await this.reminders.claim(candidate);
      if (!dispatchId) {
        summary.deduplicated += 1;
        continue;
      }
      summary.claimed += 1;

      const result = await this.communications.sendTemplateToUser({
        userId: candidate.userId,
        messageType: 'REMINDER',
        templateKey: candidate.templateKey,
        variables: this.templateVariables(candidate),
        contextType: candidate.contextType,
        contextId: candidate.contextId,
      });

      if (result.sent === true) {
        await this.reminders.markSent(dispatchId, result.messageId);
        summary.sent += 1;
      } else {
        const errorCode: string =
          'reason' in result && typeof result.reason === 'string'
            ? result.reason
            : 'WHATSAPP_DELIVERY_FAILED';
        await this.reminders.markFailed(
          dispatchId,
          result.messageId ?? null,
          errorCode,
        );
        summary.failed += 1;
      }
    }

    return summary;
  }

  private templateVariables(candidate: ReminderCandidate): Record<string, string> {
    const variables: Record<string, string> = { reference: candidate.reference };
    if (candidate.dueDate) variables.dueDate = candidate.dueDate;
    return variables;
  }
}
