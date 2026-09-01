import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UpdateOwnCompanyDto } from './dto/update-own-company.dto';

@Injectable()
export class CompaniesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findPrincipalForUser(userId: string) {
    const result = await this.db.query(
      `SELECT e.id, e.code_fodip AS "codeFodip", e.raison_sociale AS "raisonSociale",
              e.nom_commercial AS "nomCommercial", e.rccm, e.nif,
              e.forme_juridique AS "formeJuridique", e.description_activite AS "descriptionActivite",
              e.nombre_employes AS "nombreEmployes", e.telephone, e.email,
              r.nom AS region, p.nom AS prefecture, s.nom AS secteur
       FROM utilisateur_entreprises ue
       JOIN entreprises e ON e.id = ue.entreprise_id AND e.deleted_at IS NULL
       LEFT JOIN regions r ON r.id = e.region_id
       LEFT JOIN prefectures p ON p.id = e.prefecture_id
       LEFT JOIN secteurs_activite s ON s.id = e.secteur_id
       WHERE ue.utilisateur_id = $1
       ORDER BY ue.principal DESC, ue.created_at ASC
       LIMIT 1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async updatePrincipalForUser(userId: string, dto: UpdateOwnCompanyDto) {
    const current = await this.findPrincipalForUser(userId);
    if (!current) return null;

    const result = await this.db.query(
      `UPDATE entreprises e SET
         raison_sociale = COALESCE($2, e.raison_sociale),
         nom_commercial = COALESCE($3, e.nom_commercial),
         rccm = COALESCE($4, e.rccm), nif = COALESCE($5, e.nif),
         forme_juridique = COALESCE($6, e.forme_juridique),
         nombre_employes = COALESCE($7, e.nombre_employes),
         telephone = COALESCE($8, e.telephone), email = COALESCE($9, e.email),
         description_activite = COALESCE($10, e.description_activite), updated_at = NOW()
       WHERE e.id = $1
         AND EXISTS (SELECT 1 FROM utilisateur_entreprises ue WHERE ue.entreprise_id=e.id AND ue.utilisateur_id=$11)
       RETURNING e.id`,
      [current.id, dto.raisonSociale ?? null, dto.nomCommercial ?? null, dto.rccm ?? null, dto.nif ?? null,
       dto.formeJuridique ?? null, dto.nombreEmployes ?? null, dto.telephone ?? null, dto.email ?? null,
       dto.descriptionActivite ?? null, userId],
    );
    if (!result.rows[0]) return null;
    return this.findPrincipalForUser(userId);
  }
}
