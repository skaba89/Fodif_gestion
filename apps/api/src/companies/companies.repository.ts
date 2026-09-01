import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { normalizeCompanyPatch } from '../pme-policy';
import { UpdateCompanyDto } from './dto/update-company.dto';

const COMPANY_FIELDS: Record<string, string> = {
  raisonSociale: 'raison_sociale',
  nomCommercial: 'nom_commercial',
  rccm: 'rccm',
  nif: 'nif',
  formeJuridique: 'forme_juridique',
  dateCreation: 'date_creation',
  descriptionActivite: 'description_activite',
  nombreEmployes: 'nombre_employes',
  chiffreAffairesAnnuel: 'chiffre_affaires_annuel',
  telephone: 'telephone',
  email: 'email',
  siteWeb: 'site_web',
  regionId: 'region_id',
  prefectureId: 'prefecture_id',
  communeId: 'commune_id',
  adresse: 'adresse',
};

@Injectable()
export class CompaniesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findById(entrepriseId: string) {
    const result = await this.db.query(
      `SELECT
        id,
        code_fodip AS "codeFodip",
        raison_sociale AS "raisonSociale",
        nom_commercial AS "nomCommercial",
        rccm,
        nif,
        forme_juridique AS "formeJuridique",
        date_creation AS "dateCreation",
        description_activite AS "descriptionActivite",
        nombre_employes AS "nombreEmployes",
        chiffre_affaires_annuel AS "chiffreAffairesAnnuel",
        telephone,
        email,
        site_web AS "siteWeb",
        region_id AS "regionId",
        prefecture_id AS "prefectureId",
        commune_id AS "communeId",
        adresse,
        statut,
        updated_at AS "updatedAt"
      FROM entreprises
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1`,
      [entrepriseId],
    );
    return result.rows[0] ?? null;
  }

  async updateById(entrepriseId: string, dto: UpdateCompanyDto) {
    const patch = normalizeCompanyPatch(dto as unknown as Record<string, unknown>);
    const entries = Object.entries(patch);
    if (entries.length === 0) return this.findById(entrepriseId);

    const values = entries.map(([, value]) => value);
    const setters = entries.map(([key], index) => `${COMPANY_FIELDS[key]} = $${index + 1}`);
    values.push(entrepriseId);

    await this.db.query(
      `UPDATE entreprises
       SET ${setters.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length} AND deleted_at IS NULL`,
      values,
    );
    return this.findById(entrepriseId);
  }
}
