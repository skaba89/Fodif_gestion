import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@Injectable()
export class AuditRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(query: ListAuditLogsDto) {
    const offset = (query.page - 1) * query.limite;
    const result = await this.db.query(
      `SELECT log.id, log.action, log.entity_type AS "entityType", log.entity_id AS "entityId",
        log.old_values AS "oldValues", log.new_values AS "newValues", log.created_at AS "createdAt",
        actor.id AS "actorId", actor.email AS "actorEmail", actor.nom AS "actorNom", actor.prenom AS "actorPrenom",
        COUNT(*) OVER()::INT AS "total"
       FROM audit_logs log
       LEFT JOIN utilisateurs actor ON actor.id = log.utilisateur_id
       WHERE ($1::VARCHAR IS NULL OR log.entity_type = $1)
         AND ($2::VARCHAR IS NULL OR log.action = $2)
         AND ($3::UUID IS NULL OR log.entity_id = $3)
         AND ($4::VARCHAR IS NULL OR actor.email ILIKE '%' || $4 || '%'
              OR actor.nom ILIKE '%' || $4 || '%' OR actor.prenom ILIKE '%' || $4 || '%')
         AND ($5::TIMESTAMPTZ IS NULL OR log.created_at >= $5)
         AND ($6::TIMESTAMPTZ IS NULL OR log.created_at <= $6)
       ORDER BY log.created_at DESC
       LIMIT $7 OFFSET $8`,
      [
        query.entityType ?? null, query.action ?? null, query.entityId ?? null,
        query.actorSearch ?? null, query.dateFrom ?? null, query.dateTo ?? null,
        query.limite, offset,
      ],
    );
    const total = Number(result.rows[0]?.total ?? 0);
    const items = result.rows.map(({ total: _total, ...item }) => item);
    return { items, total, page: query.page, limite: query.limite };
  }

  // "preuve chronologique d'un dossier" (issue #142): every audit_logs row directly tied to the
  // dossier (DOSSIER_FINANCEMENT/DOSSIER_DOCUMENT, entity_id = dossierId) plus the FINANCEMENT
  // creation event carrying dossierId in new_values — same join trick as
  // FinancingsRepository.findById()'s own audit subquery, one level up the chain.
  async dossierAuditTrail(dossierId: string) {
    const result = await this.db.query(
      `SELECT log.id, log.action, log.entity_type AS "entityType", log.entity_id AS "entityId",
        log.old_values AS "oldValues", log.new_values AS "newValues", log.created_at AS "createdAt",
        actor.id AS "actorId", actor.email AS "actorEmail", actor.nom AS "actorNom", actor.prenom AS "actorPrenom"
       FROM audit_logs log
       LEFT JOIN utilisateurs actor ON actor.id = log.utilisateur_id
       WHERE log.entity_type IN ('DOSSIER_FINANCEMENT', 'DOSSIER_DOCUMENT', 'FINANCEMENT')
         AND (log.entity_id = $1 OR log.new_values->>'dossierId' = $1::text)
       ORDER BY log.created_at DESC
       LIMIT 100`,
      [dossierId],
    );
    return result.rows;
  }
}
