import { Injectable } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

interface KpiRow extends QueryResultRow {
  pmeEnregistrees: string;
  dossiersActifs: string;
  montantDemande: string;
  montantApprouve: string;
}

interface FinancingRow extends QueryResultRow {
  montantDecaisse: string;
  montantDu: string;
  montantRembourse: string;
  impayes: string;
}

interface ImpactRow extends QueryResultRow {
  emploisCrees: string;
  emploisMaintenus: string;
  chiffreAffaires: string;
  entreprisesSuivies: string;
}

interface GenderRow extends QueryResultRow {
  dirigeantesFemmes: string;
  dirigeantsRenseignes: string;
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly db: DatabaseService) {}

  async dashboard(query: DashboardQueryDto) {
    const values = [query.regionId ?? null, query.programmeId ?? null];
    const dossierFilter = `($1::uuid IS NULL OR portfolio.region_id = $1)
      AND ($2::uuid IS NULL OR portfolio.programme_id = $2)`;
    const financingFilter = `($1::uuid IS NULL OR financing.region_id = $1)
      AND ($2::uuid IS NULL OR financing.programme_id = $2)`;
    const impactFilter = `($1::uuid IS NULL OR impact.region_id = $1)
      AND ($2::uuid IS NULL OR impact.programme_id = $2)`;

    const [
      kpis,
      financing,
      impact,
      gender,
      pipeline,
      regions,
      sectors,
      recentApplications,
      filterRegions,
      filterProgrammes,
      freshness,
    ] = await Promise.all([
      this.db.query<KpiRow>(
        `SELECT
          COUNT(DISTINCT portfolio.entreprise_id)::text AS "pmeEnregistrees",
          COUNT(*) FILTER (WHERE portfolio.statut IN (
            'SOUMIS', 'EN_INSTRUCTION', 'COMPLEMENT_REQUIS', 'PRET_COMITE'
          ))::text AS "dossiersActifs",
          COALESCE(SUM(portfolio.montant_demande) FILTER (WHERE portfolio.statut <> 'BROUILLON'), 0)::text AS "montantDemande",
          COALESCE(SUM(portfolio.montant_approuve) FILTER (WHERE portfolio.decision = 'APPROUVE'), 0)::text AS "montantApprouve"
         FROM analytics.vw_dossier_portfolio portfolio
         WHERE ${dossierFilter}`,
        values,
      ),
      this.db.query<FinancingRow>(
        `SELECT
          COALESCE(SUM(financing.montant_decaisse), 0)::text AS "montantDecaisse",
          COALESCE(SUM(financing.montant_du), 0)::text AS "montantDu",
          COALESCE(SUM(financing.montant_rembourse), 0)::text AS "montantRembourse",
          COALESCE(SUM(financing.impaye), 0)::text AS "impayes"
         FROM analytics.vw_financing_performance financing
         WHERE ${financingFilter}`,
        values,
      ),
      this.db.query<ImpactRow>(
        `SELECT
          COALESCE(SUM(impact.emplois_crees), 0)::text AS "emploisCrees",
          COALESCE(SUM(impact.emplois_maintenus), 0)::text AS "emploisMaintenus",
          COALESCE(SUM(impact.chiffre_affaires), 0)::text AS "chiffreAffaires",
          COUNT(DISTINCT impact.entreprise_id)::text AS "entreprisesSuivies"
         FROM analytics.vw_latest_impact impact
         WHERE ${impactFilter}`,
        values,
      ),
      this.db.query<GenderRow>(
        `SELECT
          COUNT(DISTINCT portfolio.entreprise_id) FILTER (WHERE dirigeant.genre = 'FEMME')::text AS "dirigeantesFemmes",
          COUNT(DISTINCT portfolio.entreprise_id) FILTER (WHERE dirigeant.genre IS NOT NULL)::text AS "dirigeantsRenseignes"
         FROM analytics.vw_dossier_portfolio portfolio
         LEFT JOIN entreprise_dirigeants dirigeant
           ON dirigeant.entreprise_id = portfolio.entreprise_id AND dirigeant.dirigeant_principal = TRUE
         WHERE ${dossierFilter}`,
        values,
      ),
      this.db.query(
        `SELECT portfolio.statut, COUNT(*)::int AS total,
          COALESCE(SUM(portfolio.montant_demande), 0)::text AS "montantDemande"
         FROM analytics.vw_dossier_portfolio portfolio
         WHERE ${dossierFilter}
         GROUP BY portfolio.statut
         ORDER BY COUNT(*) DESC, portfolio.statut ASC`,
        values,
      ),
      this.db.query(
        `SELECT portfolio.region_id AS id, portfolio.region_nom AS nom,
          COUNT(*)::int AS dossiers,
          COALESCE(SUM(portfolio.montant_demande) FILTER (WHERE portfolio.statut <> 'BROUILLON'), 0)::text AS "montantDemande",
          COALESCE(SUM(portfolio.montant_approuve) FILTER (WHERE portfolio.decision = 'APPROUVE'), 0)::text AS "montantApprouve"
         FROM analytics.vw_dossier_portfolio portfolio
         WHERE ${dossierFilter}
         GROUP BY portfolio.region_id, portfolio.region_nom
         ORDER BY SUM(portfolio.montant_demande) DESC NULLS LAST, portfolio.region_nom ASC`,
        values,
      ),
      this.db.query(
        `SELECT portfolio.secteur_id AS id, portfolio.secteur_nom AS nom,
          COUNT(*)::int AS dossiers,
          COALESCE(SUM(portfolio.montant_demande), 0)::text AS "montantDemande"
         FROM analytics.vw_dossier_portfolio portfolio
         WHERE ${dossierFilter}
         GROUP BY portfolio.secteur_id, portfolio.secteur_nom
         ORDER BY COUNT(*) DESC, portfolio.secteur_nom ASC`,
        values,
      ),
      this.db.query(
        `SELECT portfolio.dossier_id AS id, portfolio.numero_dossier AS "numeroDossier",
          portfolio.raison_sociale AS "raisonSociale", portfolio.region_nom AS region,
          portfolio.programme_nom AS programme, portfolio.montant_demande AS "montantDemande",
          portfolio.statut, portfolio.score_total AS "scoreTotal",
          portfolio.updated_at AS "updatedAt"
         FROM analytics.vw_dossier_portfolio portfolio
         WHERE ${dossierFilter}
         ORDER BY portfolio.updated_at DESC
         LIMIT 8`,
        values,
      ),
      this.db.query(
        `SELECT id, nom FROM regions WHERE actif = TRUE ORDER BY nom ASC`,
      ),
      this.db.query(
        `SELECT id, nom FROM programmes_fodip WHERE statut = 'ACTIVE' ORDER BY nom ASC`,
      ),
      this.db.query(
        `SELECT NULLIF(GREATEST(
          COALESCE((SELECT MAX(updated_at) FROM dossiers_financement), '-infinity'::timestamptz),
          COALESCE((SELECT MAX(created_at) FROM financements), '-infinity'::timestamptz),
          COALESCE((SELECT MAX(created_at) FROM suivis_impact), '-infinity'::timestamptz),
          COALESCE((SELECT MAX(created_at) FROM remboursements), '-infinity'::timestamptz)
        ), '-infinity'::timestamptz) AS "sourceUpdatedAt"`,
      ),
    ]);

    return {
      kpis: kpis.rows[0],
      financing: financing.rows[0],
      impact: impact.rows[0],
      gender: gender.rows[0],
      pipeline: pipeline.rows,
      regions: regions.rows,
      sectors: sectors.rows,
      recentApplications: recentApplications.rows,
      filters: { regions: filterRegions.rows, programmes: filterProgrammes.rows },
      sourceUpdatedAt: freshness.rows[0]?.sourceUpdatedAt ?? null,
    };
  }
}
