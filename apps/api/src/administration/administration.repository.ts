import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { canDeactivateUser, requiresMfa } from '../admin-policy';
import { DatabaseService } from '../database/database.service';

type UserWrite = {
  email: string; nom: string; prenom?: string; telephone?: string; passwordHash: string;
  roles: string[]; entrepriseId?: string; mfaRequired: boolean;
};
type UserUpdate = { actif?: boolean; mfaRequired?: boolean; roles?: string[]; entrepriseId?: string | null };

@Injectable()
export class AdministrationRepository {
  constructor(private readonly db: DatabaseService) {}

  async listUsers(search?: string) {
    const result = await this.db.query(
      `SELECT utilisateur.id, utilisateur.email, utilisateur.nom, utilisateur.prenom, utilisateur.telephone,
        utilisateur.actif, utilisateur.mfa_required AS "mfaRequired",
        utilisateur.last_login_at AS "lastLoginAt", utilisateur.created_at AS "createdAt",
        COALESCE(ARRAY_AGG(DISTINCT role.code) FILTER (WHERE role.code IS NOT NULL), '{}') AS roles,
        relation.entreprise_id AS "entrepriseId", entreprise.raison_sociale AS "raisonSociale"
       FROM utilisateurs utilisateur
       LEFT JOIN utilisateur_roles utilisateur_role ON utilisateur_role.utilisateur_id = utilisateur.id
       LEFT JOIN roles role ON role.id = utilisateur_role.role_id
       LEFT JOIN LATERAL (
         SELECT entreprise_id FROM utilisateur_entreprises
         WHERE utilisateur_id = utilisateur.id ORDER BY principal DESC, created_at ASC LIMIT 1
       ) relation ON TRUE
       LEFT JOIN entreprises entreprise ON entreprise.id = relation.entreprise_id
       WHERE ($1::text IS NULL OR utilisateur.email ILIKE '%' || $1 || '%'
         OR utilisateur.nom ILIKE '%' || $1 || '%' OR COALESCE(utilisateur.prenom, '') ILIKE '%' || $1 || '%')
       GROUP BY utilisateur.id, relation.entreprise_id, entreprise.raison_sociale
       ORDER BY utilisateur.created_at DESC`,
      [search?.trim() || null],
    );
    return { items: result.rows, total: result.rowCount };
  }

  async listRoles() {
    const result = await this.db.query(
      `SELECT role.id, role.code, role.nom, role.description,
        COALESCE(ARRAY_AGG(permission.code ORDER BY permission.code)
          FILTER (WHERE permission.code IS NOT NULL), '{}') AS permissions
       FROM roles role
       LEFT JOIN role_permissions role_permission ON role_permission.role_id = role.id
       LEFT JOIN permissions permission ON permission.id = role_permission.permission_id
       GROUP BY role.id ORDER BY role.code`,
    );
    return { items: result.rows };
  }

  async listEnterprises() {
    const result = await this.db.query(
      `SELECT id, code_fodip AS "codeFodip", raison_sociale AS "raisonSociale"
       FROM entreprises WHERE deleted_at IS NULL ORDER BY raison_sociale`,
    );
    return { items: result.rows };
  }

  async create(actorId: string, input: UserWrite) {
    return this.db.transaction(async (client) => {
      const roleIds = await this.resolveRoleIds(client, input.roles);
      if (!roleIds) return { error: 'INVALID_ROLE' } as const;
      if (input.entrepriseId && !(await this.enterpriseExists(client, input.entrepriseId))) {
        return { error: 'INVALID_ENTERPRISE' } as const;
      }
      // Accounts holding a privileged role (SUPER_ADMIN, DIRECTION_FODIP, ...) are always MFA-enrolled,
      // regardless of what the caller passed - an admin cannot opt a sensitive role out of it.
      const mfaRequired = input.mfaRequired || requiresMfa(input.roles);
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO utilisateurs (email, nom, prenom, telephone, password_hash, actif, mfa_required)
         VALUES (LOWER($1), $2, $3, $4, $5, TRUE, $6) RETURNING id`,
        [input.email.trim(), input.nom.trim(), input.prenom?.trim() || null, input.telephone?.trim() || null,
          input.passwordHash, mfaRequired],
      );
      const id = inserted.rows[0].id;
      await this.replaceRoles(client, id, roleIds);
      await this.replaceEnterprise(client, id, input.entrepriseId ?? null);
      await this.audit(client, actorId, 'CREATE_USER', id, null, {
        email: input.email.trim().toLowerCase(), roles: input.roles, entrepriseId: input.entrepriseId ?? null,
      });
      return { id };
    });
  }

  async update(actorId: string, id: string, input: UserUpdate) {
    return this.db.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(80913001)');
      const target = await client.query<{ actif: boolean; mfaRequired: boolean; roles: string[] }>(
        `SELECT utilisateur.actif, utilisateur.mfa_required AS "mfaRequired",
          COALESCE(assigned.roles, '{}') AS roles
         FROM utilisateurs utilisateur
         LEFT JOIN LATERAL (
           SELECT ARRAY_AGG(role.code) AS roles
           FROM utilisateur_roles utilisateur_role
           JOIN roles role ON role.id = utilisateur_role.role_id
           WHERE utilisateur_role.utilisateur_id = utilisateur.id
         ) assigned ON TRUE
         WHERE utilisateur.id = $1 FOR UPDATE OF utilisateur`,
        [id],
      );
      if (!target.rows[0]) return { error: 'NOT_FOUND' } as const;

      const nextRoles = input.roles ?? target.rows[0].roles;
      const roleIds = await this.resolveRoleIds(client, nextRoles);
      if (!roleIds) return { error: 'INVALID_ROLE' } as const;
      if (input.entrepriseId && !(await this.enterpriseExists(client, input.entrepriseId))) {
        return { error: 'INVALID_ENTERPRISE' } as const;
      }
      const superAdmins = await client.query<{ total: number }>(
        `SELECT COUNT(DISTINCT utilisateur.id)::int AS total
         FROM utilisateurs utilisateur
         JOIN utilisateur_roles utilisateur_role ON utilisateur_role.utilisateur_id = utilisateur.id
         JOIN roles role ON role.id = utilisateur_role.role_id
         WHERE utilisateur.actif = TRUE AND role.code = 'SUPER_ADMIN'`,
      );
      const removesSuperAdmin = target.rows[0].roles.includes('SUPER_ADMIN') && !nextRoles.includes('SUPER_ADMIN');
      const deactivates = target.rows[0].actif && input.actif === false;
      if ((deactivates || removesSuperAdmin)
          && !canDeactivateUser(actorId, id, target.rows[0].roles, superAdmins.rows[0]?.total ?? 0)) {
        return { error: 'PROTECTED_SUPER_ADMIN' } as const;
      }

      // Accounts holding a privileged role are always MFA-enrolled: neither an explicit
      // mfaRequired:false nor a role change away from the request can turn it off on its own.
      const mfaRequired = (input.mfaRequired ?? target.rows[0].mfaRequired) || requiresMfa(nextRoles);

      await client.query(
        `UPDATE utilisateurs SET actif = COALESCE($2, actif),
          mfa_required = $3, updated_at = NOW() WHERE id = $1`,
        [id, input.actif ?? null, mfaRequired],
      );
      if (input.roles) await this.replaceRoles(client, id, roleIds);
      if (input.entrepriseId !== undefined) await this.replaceEnterprise(client, id, input.entrepriseId);
      await this.audit(client, actorId, 'UPDATE_USER', id, target.rows[0], {
        actif: input.actif ?? target.rows[0].actif,
        mfaRequired,
        roles: nextRoles, entrepriseId: input.entrepriseId,
      });
      return { id };
    });
  }

  private async resolveRoleIds(client: PoolClient, roles: string[]) {
    const result = await client.query<{ id: string }>(
      'SELECT id FROM roles WHERE code = ANY($1::text[])', [roles],
    );
    return result.rowCount === roles.length ? result.rows.map((row) => row.id) : null;
  }

  private async enterpriseExists(client: PoolClient, id: string) {
    const result = await client.query('SELECT id FROM entreprises WHERE id = $1 AND deleted_at IS NULL', [id]);
    return Boolean(result.rows[0]);
  }

  private async replaceRoles(client: PoolClient, userId: string, roleIds: string[]) {
    await client.query('DELETE FROM utilisateur_roles WHERE utilisateur_id = $1', [userId]);
    await client.query(
      `INSERT INTO utilisateur_roles (utilisateur_id, role_id)
       SELECT $1, UNNEST($2::uuid[])`, [userId, roleIds],
    );
  }

  private async replaceEnterprise(client: PoolClient, userId: string, entrepriseId: string | null) {
    await client.query('DELETE FROM utilisateur_entreprises WHERE utilisateur_id = $1', [userId]);
    if (entrepriseId) {
      await client.query(
        `INSERT INTO utilisateur_entreprises (utilisateur_id, entreprise_id, relation, principal)
         VALUES ($1, $2, 'OWNER', TRUE)`, [userId, entrepriseId],
      );
    }
  }

  private async audit(client: PoolClient, actorId: string, action: string, id: string, oldValues: unknown, newValues: unknown) {
    await client.query(
      `INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, 'UTILISATEUR', $3, $4, $5)`,
      [actorId, action, id, oldValues ? JSON.stringify(oldValues) : null, JSON.stringify(newValues)],
    );
  }
}
