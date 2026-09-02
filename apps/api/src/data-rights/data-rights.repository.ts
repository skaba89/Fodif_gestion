import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PoolClient } from 'pg';
import { canDeactivateUser } from '../admin-policy';
import { DatabaseService } from '../database/database.service';
import { decryptWithKey, deriveSecret, resolveJwtSecret } from '../security-policy';

@Injectable()
export class DataRightsRepository {
  // Axe B5: same derived key as AdministrationRepository - identical HMAC context of the same
  // base secret always yields the same key, so either repository can decrypt what the other wrote.
  private readonly piiEncryptionKey: Buffer;

  constructor(private readonly db: DatabaseService, config: ConfigService) {
    const jwtSecret = resolveJwtSecret(config.get<string>('JWT_SECRET'), config.get<string>('NODE_ENV'));
    this.piiEncryptionKey = deriveSecret(jwtSecret, 'fodip-pii-telephone-encryption-v1');
  }

  async exportProfile(userId: string) {
    const result = await this.db.query<{ telephone: string | null; [key: string]: unknown }>(
      `SELECT utilisateur.id, utilisateur.email, utilisateur.nom, utilisateur.prenom, utilisateur.telephone,
        utilisateur.actif, utilisateur.created_at AS "createdAt", utilisateur.last_login_at AS "lastLoginAt",
        COALESCE(ARRAY_AGG(DISTINCT role.code) FILTER (WHERE role.code IS NOT NULL), '{}') AS roles
       FROM utilisateurs utilisateur
       LEFT JOIN utilisateur_roles utilisateur_role ON utilisateur_role.utilisateur_id = utilisateur.id
       LEFT JOIN roles role ON role.id = utilisateur_role.role_id
       WHERE utilisateur.id = $1
       GROUP BY utilisateur.id`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return { ...row, telephone: row.telephone ? decryptWithKey(row.telephone, this.piiEncryptionKey) : null };
  }

  async exportEnterprise(entrepriseId: string) {
    const result = await this.db.query(
      `SELECT id, code_fodip AS "codeFodip", raison_sociale AS "raisonSociale", nom_commercial AS "nomCommercial",
        rccm, nif, forme_juridique AS "formeJuridique", date_creation AS "dateCreation",
        description_activite AS "descriptionActivite", nombre_employes AS "nombreEmployes",
        chiffre_affaires_annuel AS "chiffreAffairesAnnuel", telephone, email, adresse,
        created_at AS "createdAt"
       FROM entreprises WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [entrepriseId],
    );
    return result.rows[0] ?? null;
  }

  async exportDirigeants(entrepriseId: string) {
    const result = await this.db.query(
      `SELECT id, nom, prenom, fonction, email, genre, dirigeant_principal AS "dirigeantPrincipal"
       FROM entreprise_dirigeants WHERE entreprise_id = $1 ORDER BY dirigeant_principal DESC`,
      [entrepriseId],
    );
    return result.rows;
  }

  async exportDossiers(entrepriseId: string) {
    const result = await this.db.query(
      `SELECT d.id, d.numero_dossier AS "numeroDossier", p.nom AS "programmeNom",
        d.montant_demande AS "montantDemande", d.apport_personnel AS "apportPersonnel",
        d.objet_financement AS "objetFinancement", d.statut,
        d.date_soumission AS "dateSoumission", d.created_at AS "createdAt"
       FROM dossiers_financement d
       LEFT JOIN programmes_fodip p ON p.id = d.programme_id
       WHERE d.entreprise_id = $1
       ORDER BY d.created_at DESC`,
      [entrepriseId],
    );
    return result.rows;
  }

  /**
   * Erasure on request: overwrites the account's directly identifying fields with a
   * non-identifying placeholder and deactivates it. Deliberately does not touch
   * dossiers_financement/financements/audit_logs rows - those reference the account only by id
   * and carry the institution's own required financial/audit trail, not personal data of the
   * account holder, so they survive unchanged (see database/012_data_rights.sql).
   */
  async anonymize(actorId: string, targetId: string) {
    return this.db.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(80913001)'); // same key as administration.repository.ts#update: both mutate utilisateurs and must not interleave
      const target = await client.query<{ actif: boolean; anonymizedAt: Date | null; roles: string[] }>(
        `SELECT utilisateur.actif, utilisateur.anonymized_at AS "anonymizedAt",
          COALESCE(assigned.roles, '{}') AS roles
         FROM utilisateurs utilisateur
         LEFT JOIN LATERAL (
           SELECT ARRAY_AGG(role.code) AS roles
           FROM utilisateur_roles utilisateur_role
           JOIN roles role ON role.id = utilisateur_role.role_id
           WHERE utilisateur_role.utilisateur_id = utilisateur.id
         ) assigned ON TRUE
         WHERE utilisateur.id = $1 FOR UPDATE OF utilisateur`,
        [targetId],
      );
      if (!target.rows[0]) return { error: 'NOT_FOUND' } as const;
      if (target.rows[0].anonymizedAt) return { error: 'ALREADY_ANONYMIZED' } as const;

      const superAdmins = await client.query<{ total: number }>(
        `SELECT COUNT(DISTINCT utilisateur.id)::int AS total
         FROM utilisateurs utilisateur
         JOIN utilisateur_roles utilisateur_role ON utilisateur_role.utilisateur_id = utilisateur.id
         JOIN roles role ON role.id = utilisateur_role.role_id
         WHERE utilisateur.actif = TRUE AND role.code = 'SUPER_ADMIN'`,
      );
      // Same protection as a deactivation (administration.repository.ts#update): an admin cannot
      // erase their own account through this endpoint, nor the last active super-admin.
      if (!canDeactivateUser(actorId, targetId, target.rows[0].roles, superAdmins.rows[0]?.total ?? 0)) {
        return { error: 'PROTECTED_SUPER_ADMIN' } as const;
      }

      await client.query(
        `UPDATE utilisateurs SET
          nom = 'Compte anonymisé', prenom = NULL, telephone = NULL,
          email = 'anonymise+' || id || '@fodip.invalid',
          actif = FALSE, anonymized_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [targetId],
      );
      await this.audit(client, actorId, 'ANONYMIZE_USER', 'UTILISATEUR', targetId, null, { anonymizedAt: new Date().toISOString() });
      return { id: targetId };
    });
  }

  async auditExport(userId: string) {
    await this.db.query(
      `INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, new_values)
       VALUES ($1, 'DATA_EXPORT', 'UTILISATEUR', $1, $2)`,
      [userId, JSON.stringify({ exportedAt: new Date().toISOString() })],
    );
  }

  private async audit(
    client: PoolClient, userId: string, action: string, entityType: string, entityId: string,
    oldValues: unknown, newValues: unknown,
  ) {
    await client.query(
      `INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entityType, entityId, oldValues ? JSON.stringify(oldValues) : null, JSON.stringify(newValues)],
    );
  }
}
