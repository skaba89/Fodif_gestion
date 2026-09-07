import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface ReminderCandidate {
  userId: string;
  ruleKey: string;
  templateKey: string;
  contextType: 'ECHEANCE' | 'DOSSIER_DOCUMENT' | 'DOSSIER';
  contextId: string;
  scheduledFor: string;
  reference: string;
  dueDate: string | null;
}

@Injectable()
export class ReminderRepository {
  constructor(private readonly db: DatabaseService) {}

  async listCandidates(referenceDate?: string): Promise<ReminderCandidate[]> {
    const result = await this.db.query<ReminderCandidate>(
      `WITH params AS (
         SELECT COALESCE($1::date, timezone('Africa/Conakry', NOW())::date) AS run_date
       ),
       repayment_base AS (
         SELECT
           ue.utilisateur_id AS "userId",
           echeance.id AS "contextId",
           financement.numero_financement AS reference,
           echeance.date_echeance::text AS "dueDate",
           (echeance.date_echeance - params.run_date) AS day_delta,
           params.run_date::text AS "scheduledFor"
         FROM params
         JOIN echeances echeance ON TRUE
         JOIN financements financement ON financement.id = echeance.financement_id
         JOIN utilisateur_entreprises ue
           ON ue.entreprise_id = financement.entreprise_id AND ue.principal = TRUE
         JOIN utilisateurs utilisateur
           ON utilisateur.id = ue.utilisateur_id AND utilisateur.actif = TRUE
         JOIN whatsapp_preferences preference
           ON preference.utilisateur_id = utilisateur.id
          AND preference.consent_status = 'OPTED_IN'
         LEFT JOIN remboursements remboursement ON remboursement.echeance_id = echeance.id
         WHERE financement.statut = 'ACTIF'
         GROUP BY ue.utilisateur_id, echeance.id, financement.numero_financement,
                  echeance.date_echeance, params.run_date, echeance.montant_total_du
         HAVING GREATEST(
           echeance.montant_total_du - COALESCE(SUM(remboursement.montant_paye), 0),
           0
         ) > 0
       ),
       repayment_candidates AS (
         SELECT
           "userId",
           CASE day_delta
             WHEN 7 THEN 'REPAYMENT_DUE_J7'
             WHEN 2 THEN 'REPAYMENT_DUE_J2'
             WHEN 0 THEN 'REPAYMENT_DUE_TODAY'
             WHEN -1 THEN 'REPAYMENT_OVERDUE_D1'
             WHEN -3 THEN 'REPAYMENT_OVERDUE_D3'
             WHEN -7 THEN 'REPAYMENT_OVERDUE_D7'
             WHEN -14 THEN 'REPAYMENT_OVERDUE_D14'
             WHEN -30 THEN 'REPAYMENT_OVERDUE_D30'
           END AS "ruleKey",
           CASE day_delta
             WHEN 7 THEN 'repayment_due_7d'
             WHEN 2 THEN 'repayment_due_2d'
             WHEN 0 THEN 'repayment_due_today'
             WHEN -1 THEN 'repayment_overdue_1d'
             WHEN -3 THEN 'repayment_overdue_3d'
             WHEN -7 THEN 'repayment_overdue_7d'
             WHEN -14 THEN 'repayment_overdue_14d'
             WHEN -30 THEN 'repayment_overdue_30d'
           END AS "templateKey",
           'ECHEANCE'::text AS "contextType",
           "contextId",
           "scheduledFor",
           reference,
           "dueDate"
         FROM repayment_base
         WHERE day_delta IN (7, 2, 0, -1, -3, -7, -14, -30)
       ),
       document_base AS (
         SELECT
           ue.utilisateur_id AS "userId",
           document.id AS "contextId",
           dossier.numero_dossier AS reference,
           (params.run_date - COALESCE(document.verified_at, document.updated_at)::date) AS age_days,
           params.run_date::text AS "scheduledFor"
         FROM params
         JOIN dossier_documents document ON TRUE
         JOIN dossiers_financement dossier ON dossier.id = document.dossier_id
         JOIN utilisateur_entreprises ue
           ON ue.entreprise_id = dossier.entreprise_id AND ue.principal = TRUE
         JOIN utilisateurs utilisateur
           ON utilisateur.id = ue.utilisateur_id AND utilisateur.actif = TRUE
         JOIN whatsapp_preferences preference
           ON preference.utilisateur_id = utilisateur.id
          AND preference.consent_status = 'OPTED_IN'
         WHERE document.statut_verification = 'A_COMPLETER'
           AND document.superseded_by IS NULL
       ),
       document_candidates AS (
         SELECT
           "userId",
           CASE age_days
             WHEN 0 THEN 'DOCUMENT_ACTION_D0'
             WHEN 3 THEN 'DOCUMENT_ACTION_D3'
             WHEN 7 THEN 'DOCUMENT_ACTION_D7'
             WHEN 14 THEN 'DOCUMENT_ACTION_D14'
           END AS "ruleKey",
           'document_action_required'::text AS "templateKey",
           'DOSSIER_DOCUMENT'::text AS "contextType",
           "contextId",
           "scheduledFor",
           reference,
           NULL::text AS "dueDate"
         FROM document_base
         WHERE age_days IN (0, 3, 7, 14)
       ),
       dossier_base AS (
         SELECT
           ue.utilisateur_id AS "userId",
           dossier.id AS "contextId",
           dossier.numero_dossier AS reference,
           (params.run_date - dossier.updated_at::date) AS age_days,
           params.run_date::text AS "scheduledFor"
         FROM params
         JOIN dossiers_financement dossier ON TRUE
         JOIN utilisateur_entreprises ue
           ON ue.entreprise_id = dossier.entreprise_id AND ue.principal = TRUE
         JOIN utilisateurs utilisateur
           ON utilisateur.id = ue.utilisateur_id AND utilisateur.actif = TRUE
         JOIN whatsapp_preferences preference
           ON preference.utilisateur_id = utilisateur.id
          AND preference.consent_status = 'OPTED_IN'
         WHERE dossier.statut = 'COMPLEMENT_REQUIS'
           AND NOT EXISTS (
             SELECT 1
             FROM dossier_documents current_document
             WHERE current_document.dossier_id = dossier.id
               AND current_document.statut_verification = 'A_COMPLETER'
               AND current_document.superseded_by IS NULL
           )
       ),
       dossier_candidates AS (
         SELECT
           "userId",
           CASE age_days
             WHEN 0 THEN 'DOSSIER_COMPLEMENT_D0'
             WHEN 3 THEN 'DOSSIER_COMPLEMENT_D3'
             WHEN 7 THEN 'DOSSIER_COMPLEMENT_D7'
             WHEN 14 THEN 'DOSSIER_COMPLEMENT_D14'
           END AS "ruleKey",
           'application_action_required'::text AS "templateKey",
           'DOSSIER'::text AS "contextType",
           "contextId",
           "scheduledFor",
           reference,
           NULL::text AS "dueDate"
         FROM dossier_base
         WHERE age_days IN (0, 3, 7, 14)
       )
       SELECT * FROM repayment_candidates
       UNION ALL
       SELECT * FROM document_candidates
       UNION ALL
       SELECT * FROM dossier_candidates
       ORDER BY "scheduledFor", "ruleKey", reference`,
      [referenceDate ?? null],
    );
    return result.rows;
  }

  async quarantineStaleClaims(): Promise<number> {
    const result = await this.db.query<{ id: string }>(
      `UPDATE whatsapp_reminder_dispatches
       SET status = 'REVIEW_REQUIRED',
           last_error_code = 'AMBIGUOUS_STALE_CLAIM',
           updated_at = NOW()
       WHERE status = 'CLAIMED'
         AND last_attempt_at <= NOW() - INTERVAL '15 minutes'
       RETURNING id`,
    );
    return result.rowCount ?? result.rows.length;
  }

  async claim(candidate: ReminderCandidate): Promise<string | null> {
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO whatsapp_reminder_dispatches (
         rule_key, utilisateur_id, context_type, context_id, scheduled_for,
         status, attempt_count, last_attempt_at
       ) VALUES ($1, $2, $3, $4, $5::date, 'CLAIMED', 1, NOW())
       ON CONFLICT (rule_key, utilisateur_id, context_type, context_id, scheduled_for)
       DO UPDATE SET
         status = 'CLAIMED',
         attempt_count = whatsapp_reminder_dispatches.attempt_count + 1,
         last_attempt_at = NOW(),
         last_error_code = NULL,
         updated_at = NOW()
       WHERE whatsapp_reminder_dispatches.status = 'FAILED'
         AND whatsapp_reminder_dispatches.last_attempt_at <= NOW() - INTERVAL '1 hour'
       RETURNING id`,
      [
        candidate.ruleKey,
        candidate.userId,
        candidate.contextType,
        candidate.contextId,
        candidate.scheduledFor,
      ],
    );
    return result.rows[0]?.id ?? null;
  }

  async markSent(dispatchId: string, whatsappMessageId: string): Promise<void> {
    await this.db.query(
      `UPDATE whatsapp_reminder_dispatches
       SET status = 'SENT', whatsapp_message_id = $2, sent_at = NOW(),
           last_error_code = NULL, updated_at = NOW()
       WHERE id = $1`,
      [dispatchId, whatsappMessageId],
    );
  }

  async markFailed(dispatchId: string, whatsappMessageId: string | null, errorCode: string): Promise<void> {
    await this.db.query(
      `UPDATE whatsapp_reminder_dispatches
       SET status = 'FAILED', whatsapp_message_id = $2, last_error_code = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [dispatchId, whatsappMessageId, errorCode],
    );
  }
}
