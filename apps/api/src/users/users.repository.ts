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
  mfaSecretEncrypted: string | null;
  mfaConfirmedAt: Date | null;
  entrepriseId: string | null;
  roles: string[];
  permissions: string[];
}

interface AuthUserRow {
  id: string;
  email: string;
  nom: string;
  prenom: string | null;
  password_hash: string | null;
  actif: boolean;
  mfa_required: boolean;
  mfa_secret_encrypted: string | null;
  mfa_confirmed_at: Date | null;
  entreprise_id: string | null;
  roles: string[] | null;
  permissions: string[] | null;
}

const AUTH_USER_QUERY = `
  SELECT
    u.id,
    u.email,
    u.nom,
    u.prenom,
    u.password_hash,
    u.actif,
    u.mfa_required,
    u.mfa_secret_encrypted,
    u.mfa_confirmed_at,
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
  WHERE {where}
  GROUP BY u.id, ue.entreprise_id
  LIMIT 1
`;

@Injectable()
export class UsersRepository {
  constructor(private readonly db: DatabaseService) {}

  findForAuthentication(email: string): Promise<AuthUserRecord | null> {
    return this.findOne('LOWER(u.email) = LOWER($1)', [email.trim()]);
  }

  findAuthenticatedById(id: string): Promise<AuthUserRecord | null> {
    return this.findOne('u.id = $1', [id]);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.db.query('UPDATE utilisateurs SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [userId]);
  }

  /** Stores a freshly generated TOTP seed as pending (unconfirmed) enrollment. */
  async setPendingMfaSecret(userId: string, encryptedSecret: string): Promise<void> {
    await this.db.query(
      `UPDATE utilisateurs
       SET mfa_secret_encrypted = $2, mfa_confirmed_at = NULL, mfa_last_used_step = NULL, updated_at = NOW()
       WHERE id = $1`,
      [userId, encryptedSecret],
    );
  }

  /** Marks the pending TOTP seed as confirmed after the user proved possession with a valid code. */
  async confirmMfaSecret(userId: string): Promise<void> {
    await this.db.query('UPDATE utilisateurs SET mfa_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1', [userId]);
  }

  /**
   * Atomically records a TOTP time-step as used, rejecting it if it (or a later step) was
   * already consumed. Prevents replay of a captured code within its validity window.
   */
  async consumeMfaStep(userId: string, step: number): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE utilisateurs
       SET mfa_last_used_step = $2, updated_at = NOW()
       WHERE id = $1 AND (mfa_last_used_step IS NULL OR mfa_last_used_step < $2)
       RETURNING id`,
      [userId, step],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async findOne(whereClause: string, params: unknown[]): Promise<AuthUserRecord | null> {
    const result = await this.db.query<AuthUserRow>(AUTH_USER_QUERY.replace('{where}', whereClause), params);
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
      mfaSecretEncrypted: row.mfa_secret_encrypted,
      mfaConfirmedAt: row.mfa_confirmed_at,
      entrepriseId: row.entreprise_id,
      roles: row.roles ?? [],
      permissions: row.permissions ?? [],
    };
  }
}
