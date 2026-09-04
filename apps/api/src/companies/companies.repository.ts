import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { normalizeCompanyPatch } from '../pme-policy';
import { UpdateCompanyDto } from './dto/update-company.dto';

// Axe E5 (verrouillage optimiste, docs/14-ROADMAP-SAAS-PREMIUM.md) - a discriminated result rather
// than null/throw: NOT_FOUND and VERSION_CONFLICT need two different HTTP responses (404 vs 409),
// and CompaniesService is where that translation belongs.
export type UpdateCompanyOutcome =
  | { outcome: 'NOT_FOUND' }
  | { outcome: 'VERSION_CONFLICT' }
  | { outcome: 'OK'; company: Record<string, unknown> };

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
        version,
        updated_at AS "updatedAt"
      FROM entreprises
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1`,
      [entrepriseId],
    );
    return result.rows[0] ?? null;
  }

  async updateById(entrepriseId: string, dto: UpdateCompanyDto): Promise<UpdateCompanyOutcome> {
    const patch = normalizeCompanyPatch(dto as unknown as Record<string, unknown>);
    const entries = Object.entries(patch);

    return this.db.transaction(async (client) => {
      // Locked and read first, rather than folding the version check into the UPDATE's WHERE
      // clause, so the service layer can tell a missing row (404) apart from a stale version
      // (409) - two different, correct responses for two different reasons nothing was written.
      const locked = await client.query<{ version: number }>(
        'SELECT version FROM entreprises WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [entrepriseId],
      );
      if (!locked.rows[0]) return { outcome: 'NOT_FOUND' };
      if (locked.rows[0].version !== dto.version) return { outcome: 'VERSION_CONFLICT' };

      if (entries.length > 0) {
        const values = entries.map(([, value]) => value);
        const setters = entries.map(([key], index) => `${COMPANY_FIELDS[key]} = $${index + 1}`);
        values.push(entrepriseId);
        await client.query(
          `UPDATE entreprises SET ${setters.join(', ')}, version = version + 1, updated_at = NOW()
           WHERE id = $${values.length}`,
          values,
        );
      }

      const refreshed = await client.query(
        `SELECT id, code_fodip AS "codeFodip", raison_sociale AS "raisonSociale",
          nom_commercial AS "nomCommercial", rccm, nif, forme_juridique AS "formeJuridique",
          date_creation AS "dateCreation", description_activite AS "descriptionActivite",
          nombre_employes AS "nombreEmployes", chiffre_affaires_annuel AS "chiffreAffairesAnnuel",
          telephone, email, site_web AS "siteWeb", region_id AS "regionId",
          prefecture_id AS "prefectureId", commune_id AS "communeId", adresse, statut, version,
          updated_at AS "updatedAt"
         FROM entreprises WHERE id = $1`,
        [entrepriseId],
      );
      return { outcome: 'OK', company: refreshed.rows[0] };
    });
  }
}
