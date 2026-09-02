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
       ORDER BY log.created_at DESC
       LIMIT $3 OFFSET $4`,
      [query.entityType ?? null, query.action ?? null, query.limite, offset],
    );
    const total = Number(result.rows[0]?.total ?? 0);
    const items = result.rows.map(({ total: _total, ...item }) => item);
    return { items, total, page: query.page, limite: query.limite };
  }
}
