import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly db: DatabaseService) {}

  async listOwn(userId: string, unreadOnly: boolean) {
    const result = await this.db.query(
      `SELECT id, type, titre, message, lien, entity_type AS "entityType",
        entity_id AS "entityId", lu_at AS "luAt", created_at AS "createdAt"
       FROM notifications
       WHERE utilisateur_id = $1 AND ($2::boolean = FALSE OR lu_at IS NULL)
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId, unreadOnly],
    );
    const unread = await this.db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM notifications
       WHERE utilisateur_id = $1 AND lu_at IS NULL`,
      [userId],
    );
    return { items: result.rows, unread: unread.rows[0]?.total ?? 0 };
  }

  async markRead(userId: string, id: string) {
    const result = await this.db.query(
      `UPDATE notifications SET lu_at = COALESCE(lu_at, NOW())
       WHERE id = $1 AND utilisateur_id = $2 RETURNING id, lu_at AS "luAt"`,
      [id, userId],
    );
    return result.rows[0] ?? null;
  }

  async markAllRead(userId: string) {
    const result = await this.db.query(
      `UPDATE notifications SET lu_at = NOW()
       WHERE utilisateur_id = $1 AND lu_at IS NULL RETURNING id`,
      [userId],
    );
    return { updated: result.rowCount };
  }
}

