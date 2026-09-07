import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface WhatsAppPreference {
  id: string;
  userId: string;
  telephoneE164: string;
  consentStatus: 'OPTED_IN' | 'OPTED_OUT';
  consentSource: string | null;
  consentedAt: Date | null;
  optedOutAt: Date | null;
  updatedAt: Date;
}

interface CreateAttemptInput {
  userId: string;
  preferenceId?: string;
  telephoneE164?: string;
  messageType: 'REMINDER' | 'SUPPORT' | 'CHATBOT' | 'TRANSACTIONAL';
  templateKey: string;
  contextType?: string;
  contextId?: string;
  status?: 'QUEUED' | 'SKIPPED';
  errorCode?: string;
}

@Injectable()
export class CommunicationsRepository {
  constructor(private readonly db: DatabaseService) {}

  async getPreference(userId: string): Promise<WhatsAppPreference | null> {
    const result = await this.db.query<WhatsAppPreference>(
      `SELECT id,
              utilisateur_id AS "userId",
              telephone_e164 AS "telephoneE164",
              consent_status AS "consentStatus",
              consent_source AS "consentSource",
              consented_at AS "consentedAt",
              opted_out_at AS "optedOutAt",
              updated_at AS "updatedAt"
       FROM whatsapp_preferences
       WHERE utilisateur_id = $1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async optIn(userId: string, telephoneE164: string, source: string): Promise<WhatsAppPreference> {
    const result = await this.db.query<WhatsAppPreference>(
      `INSERT INTO whatsapp_preferences (
          utilisateur_id, telephone_e164, consent_status, consent_source, consented_at, opted_out_at
       ) VALUES ($1, $2, 'OPTED_IN', $3, NOW(), NULL)
       ON CONFLICT (utilisateur_id) DO UPDATE SET
          telephone_e164 = EXCLUDED.telephone_e164,
          consent_status = 'OPTED_IN',
          consent_source = EXCLUDED.consent_source,
          consented_at = NOW(),
          opted_out_at = NULL,
          updated_at = NOW()
       RETURNING id,
                 utilisateur_id AS "userId",
                 telephone_e164 AS "telephoneE164",
                 consent_status AS "consentStatus",
                 consent_source AS "consentSource",
                 consented_at AS "consentedAt",
                 opted_out_at AS "optedOutAt",
                 updated_at AS "updatedAt"`,
      [userId, telephoneE164, source],
    );
    return result.rows[0];
  }

  async optOut(userId: string, source: string): Promise<WhatsAppPreference | null> {
    const result = await this.db.query<WhatsAppPreference>(
      `UPDATE whatsapp_preferences
       SET consent_status = 'OPTED_OUT',
           consent_source = $2,
           opted_out_at = NOW(),
           updated_at = NOW()
       WHERE utilisateur_id = $1
       RETURNING id,
                 utilisateur_id AS "userId",
                 telephone_e164 AS "telephoneE164",
                 consent_status AS "consentStatus",
                 consent_source AS "consentSource",
                 consented_at AS "consentedAt",
                 opted_out_at AS "optedOutAt",
                 updated_at AS "updatedAt"`,
      [userId, source],
    );
    return result.rows[0] ?? null;
  }

  async createOutboundAttempt(input: CreateAttemptInput): Promise<string> {
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO whatsapp_messages (
          utilisateur_id,
          preference_id,
          direction,
          message_type,
          template_key,
          status,
          recipient_fingerprint,
          context_type,
          context_id,
          error_code
       ) VALUES (
          $1,
          $2,
          'OUTBOUND',
          $3,
          $4,
          $5,
          CASE WHEN $6::text IS NULL THEN NULL ELSE encode(digest($6, 'sha256'), 'hex') END,
          $7,
          $8,
          $9
       )
       RETURNING id`,
      [
        input.userId,
        input.preferenceId ?? null,
        input.messageType,
        input.templateKey,
        input.status ?? 'QUEUED',
        input.telephoneE164 ?? null,
        input.contextType ?? null,
        input.contextId ?? null,
        input.errorCode ?? null,
      ],
    );
    return result.rows[0].id;
  }

  async markSent(messageId: string, provider: string, providerMessageId?: string): Promise<void> {
    await this.db.query(
      `UPDATE whatsapp_messages
       SET status = 'SENT',
           provider = $2,
           provider_message_id = $3,
           sent_at = NOW(),
           error_code = NULL
       WHERE id = $1`,
      [messageId, provider, providerMessageId ?? null],
    );
  }

  async markFailed(messageId: string, provider: string, errorCode: string): Promise<void> {
    await this.db.query(
      `UPDATE whatsapp_messages
       SET status = 'FAILED',
           provider = $2,
           error_code = $3,
           failed_at = NOW()
       WHERE id = $1`,
      [messageId, provider, errorCode],
    );
  }
}
