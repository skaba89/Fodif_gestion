import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface AuthUserRecord {
  id: string;
  email: string;
  nom: string;
  prenom: string | null;
  passwordHash: string | null;
  actif: boolean;
  mfaRequired: boolean;
  entrepriseId: string | null;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class UsersRepository {
  constructor(private readonly db: DatabaseService) {}

  async findForAuthentication(email: string): Promise<AuthUserRecord | null> {
    const result = await this.db.query<{
      id: string;
      email: string;
      nom: string;
      prenom: string | null;
      password_hash: string | null;
      actif: boolean;
      mfa_required: boolean;
      entreprise_id: string | null;
      roles: string[] | null;
      permissions: string[] | null;
    }>(
      `
      SELECT
        u.id,
        u.email,
        u.nom,
        u.prenom,
        u.password_hash,
        u.actif,
        u.mfa_required,
        ue.entreprise_id,
        COALESCE(ARRAY_AGG(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles,
        COALESCE(ARRAY_AGG(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
      FROM utilisateurs u
      LEFT JOIN LATERAL (
        SELECT relation.entreprise_id
        FROM utilisateur_entreprises relation
        WHERE relation.utilisateur_id = u.id
        ORDER BY relation.principal DESC, relation.created_at ASC
        LIMIT 1
      ) ue ON TRUE
      LEFT JOIN utilisateur_roles ur ON ur.utilisateur_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE LOWER(u.email) = LOWER($1)
      GROUP BY u.id, ue.entreprise_id
      LIMIT 1
      `,
      [email.trim()],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      nom: row.nom,
      prenom: row.prenom,
      passwordHash: row.password_hash,
      actif: row.actif,
      mfaRequired: row.mfa_required,
      entrepriseId: row.entreprise_id,
      roles: row.roles ?? [],
      permissions: row.permissions ?? [],
    };
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.db.query('UPDATE utilisateurs SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [userId]);
  }
}
