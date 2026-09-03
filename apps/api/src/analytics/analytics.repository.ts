import { Injectable } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

interface KpiRow extends QueryResultRow {
  pmeEnregistrees: string;
  dossiersActifs: string;
  dossiersDeposes: string;
  dossiersEnInstruction: string;
  dossiersApprouves: string;
  dossiersRejetes: string;
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

interface YouthRow extends QueryResultRow {
  dirigeantsJeunes: string;
  dirigeantsAgeRenseigne: string;
}

export interface BreakdownRow extends QueryResultRow {
  id: string | null;
  nom: string;
  dossiers: number;
  montantDemande: string;
  montantApprouve?: string;
}

export interface BankBreakdownRow extends QueryResultRow {
  id: string | null;
  nom: string;
  financements: number;
  montantDecaisse: string;
  montantRembourse: string;
  impayes: string;
}

// "Points d'attention" thresholds - mission "présentation Directeur général" (section 4).
// Deliberately named constants, not magic numbers buried in SQL, so a future change to what
// counts as "blocked" or "overdue" is a one-line review, not a SQL archaeology exercise.
const SLA_INSTRUCTION_JOURS = 15; // dossier en EN_INSTRUCTION/COMPLEMENT_REQUIS depuis plus longtemps que ça = "bloqué"
const IMPACT_STALENESS_MOIS = 12; // financement actif sans suivi d'impact depuis plus longtemps que ça = "donnée non actualisée"
const CONCENTRATION_SEUIL_PCT = 40; // part du portefeuille (montant demandé) dans une seule région/programme au-delà de laquelle on alerte

/**
 * Each `*FilterFor` helper below returns one WHERE fragment together with the exact values array
 * it needs - never a shared, longer array some queries only partially reference. Learned the hard
 * way while writing this file's own integration test (test/integration/analytics.integration-spec.ts):
 * node-postgres's extended query protocol requires every `$n` placeholder actually present in the
 * SQL text to receive a bindable value AND requires the values array's length to match exactly how
 * many distinct placeholders the text uses - passing a longer "just in case" array that a given
 * query only references *some* of ("$1..$3 and $6..$7, skipping $4/$5") fails at bind time
 * ("could not determine data type of parameter $N" for the never-referenced one, or "bind message
 * supplies N parameters, but prepared statement requires M" for the mismatch) - it does not
 * silently ignore the unused entries the way passing extra arguments to a JS function would.
 */
function dossierFilterFor(query: DashboardQueryDto, alias: string): { sql: string; values: unknown[] } {
  return {
    sql: `($1::uuid IS NULL OR ${alias}.region_id = $1)
      AND ($2::uuid IS NULL OR ${alias}.programme_id = $2)
      AND ($3::uuid IS NULL OR ${alias}.secteur_id = $3)
      AND ($4::text IS NULL OR ${alias}.statut = $4)
      AND ($5::date IS NULL OR ${alias}.date_soumission::date >= $5)
      AND ($6::date IS NULL OR ${alias}.date_soumission::date <= $6)`,
    values: [query.regionId ?? null, query.programmeId ?? null, query.secteurId ?? null, query.statut ?? null, query.from ?? null, query.to ?? null],
  };
}

function financingFilterFor(query: DashboardQueryDto, alias: string): { sql: string; values: unknown[] } {
  return {
    sql: `($1::uuid IS NULL OR ${alias}.region_id = $1)
      AND ($2::uuid IS NULL OR ${alias}.programme_id = $2)
      AND ($3::uuid IS NULL OR ${alias}.secteur_id = $3)
      AND ($4::uuid IS NULL OR ${alias}.banque_partenaire_id = $4)
      AND ($5::date IS NULL OR ${alias}.created_at::date >= $5)
      AND ($6::date IS NULL OR ${alias}.created_at::date <= $6)`,
    values: [query.regionId ?? null, query.programmeId ?? null, query.secteurId ?? null, query.banqueId ?? null, query.from ?? null, query.to ?? null],
  };
}

function impactFilterFor(query: DashboardQueryDto, alias: string): { sql: string; values: unknown[] } {
  return {
    sql: `($1::uuid IS NULL OR ${alias}.region_id = $1)
      AND ($2::uuid IS NULL OR ${alias}.programme_id = $2)
      AND ($3::uuid IS NULL OR ${alias}.secteur_id = $3)
      AND ($4::date IS NULL OR ${alias}.periode >= $4)
      AND ($5::date IS NULL OR ${alias}.periode <= $5)`,
    values: [query.regionId ?? null, query.programmeId ?? null, query.secteurId ?? null, query.from ?? null, query.to ?? null],
  };
}

// Cross-cutting scope for alerts() - region/programme/secteur (+banque for the financing-rooted
// queries) only, deliberately not statut/from/to: an alert is about the *current* state of the
// portfolio the filters describe, not a historical window.
function financingScopeFor(query: DashboardQueryDto, alias: string): { sql: string; values: unknown[] } {
  return {
    sql: `($1::uuid IS NULL OR ${alias}.region_id = $1)
      AND ($2::uuid IS NULL OR ${alias}.programme_id = $2)
      AND ($3::uuid IS NULL OR ${alias}.secteur_id = $3)
      AND ($4::uuid IS NULL OR ${alias}.banque_partenaire_id = $4)`,
    values: [query.regionId ?? null, query.programmeId ?? null, query.secteurId ?? null, query.banqueId ?? null],
  };
}

function dossierScopeFor(query: DashboardQueryDto, alias: string): { sql: string; values: unknown[] } {
  return {
    sql: `($1::uuid IS NULL OR ${alias}.region_id = $1)
      AND ($2::uuid IS NULL OR ${alias}.programme_id = $2)
      AND ($3::uuid IS NULL OR ${alias}.secteur_id = $3)`,
    values: [query.regionId ?? null, query.programmeId ?? null, query.secteurId ?? null],
  };
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly db: DatabaseService) {}

  async dashboard(query: DashboardQueryDto) {
    const dossier = dossierFilterFor(query, 'portfolio');
    const financing = financingFilterFor(query, 'financing');
    const impact = impactFilterFor(query, 'impact');

    const [
      kpis,
      financingTotals,
      impactTotals,
      gender,
      youth,
      pipeline,
      regions,
      sectors,
      programs,
      banks,
      recentApplications,
      filterRegions,
      filterProgrammes,
      filterSecteurs,
      filterBanques,
      freshness,
    ] = await Promise.all([
      this.db.query<KpiRow>(
        `SELECT
          COUNT(DISTINCT portfolio.entreprise_id)::text AS "pmeEnregistrees",
          COUNT(*) FILTER (WHERE portfolio.statut IN (
            'SOUMIS', 'EN_INSTRUCTION', 'COMPLEMENT_REQUIS', 'PRET_COMITE'
          ))::text AS "dossiersActifs",
          COUNT(*) FILTER (WHERE portfolio.statut <> 'BROUILLON')::text AS "dossiersDeposes",
          COUNT(*) FILTER (WHERE portfolio.statut IN ('EN_INSTRUCTION', 'COMPLEMENT_REQUIS'))::text AS "dossiersEnInstruction",
          COUNT(*) FILTER (WHERE portfolio.decision = 'APPROUVE')::text AS "dossiersApprouves",
          COUNT(*) FILTER (WHERE portfolio.decision = 'REJETE')::text AS "dossiersRejetes",
          COALESCE(SUM(portfolio.montant_demande) FILTER (WHERE portfolio.statut <> 'BROUILLON'), 0)::text AS "montantDemande",
          COALESCE(SUM(portfolio.montant_approuve) FILTER (WHERE portfolio.decision = 'APPROUVE'), 0)::text AS "montantApprouve"
         FROM analytics.vw_dossier_portfolio portfolio
         WHERE ${dossier.sql}`,
        dossier.values,
      ),
      this.db.query<FinancingRow>(
        `SELECT
          COALESCE(SUM(financing.montant_decaisse), 0)::text AS "montantDecaisse",
          COALESCE(SUM(financing.montant_du), 0)::text AS "montantDu",
          COALESCE(SUM(financing.montant_rembourse), 0)::text AS "montantRembourse",
          COALESCE(SUM(financing.impaye), 0)::text AS "impayes"
         FROM analytics.vw_financing_performance financing
         WHERE ${financing.sql}`,
        financing.values,
      ),
      this.db.query<ImpactRow>(
        `SELECT
          COALESCE(SUM(impact.emplois_crees), 0)::text AS "emploisCrees",
          COALESCE(SUM(impact.emplois_maintenus), 0)::text AS "emploisMaintenus",
          COALESCE(SUM(impact.chiffre_affaires), 0)::text AS "chiffreAffaires",
          COUNT(DISTINCT impact.entreprise_id)::text AS "entreprisesSuivies"
         FROM analytics.vw_latest_impact impact
         WHERE ${impact.sql}`,
        impact.values,
      ),
      this.db.query<GenderRow>(
        `SELECT
          COUNT(DISTINCT portfolio.entreprise_id) FILTER (WHERE dirigeant.genre = 'FEMME')::text AS "dirigeantesFemmes",
          COUNT(DISTINCT portfolio.entreprise_id) FILTER (WHERE dirigeant.genre IS NOT NULL)::text AS "dirigeantsRenseignes"
         FROM analytics.vw_dossier_portfolio portfolio
         LEFT JOIN entreprise_dirigeants dirigeant
           ON dirigeant.entreprise_id = portfolio.entreprise_id AND dirigeant.dirigeant_principal = TRUE
         WHERE ${dossier.sql}`,
        dossier.values,
      ),
      // "Jeune entrepreneur" - moins de 35 ans au moment du dépôt du dossier, seuil courant dans
      // les programmes d'appui à l'entrepreneuriat en Afrique francophone (ex. définitions
      // BAD/PNUD "jeunesse entrepreneuriale"). Non normatif ailleurs dans ce dépôt - documenté ici
      // faute d'un seuil déjà défini dans le schéma ou les politiques métier existantes.
      this.db.query<YouthRow>(
        `SELECT
          COUNT(DISTINCT portfolio.entreprise_id)
            FILTER (WHERE dirigeant.date_naissance IS NOT NULL
              AND AGE(COALESCE(portfolio.date_soumission, portfolio.created_at), dirigeant.date_naissance) < INTERVAL '35 years'
            )::text AS "dirigeantsJeunes",
          COUNT(DISTINCT portfolio.entreprise_id) FILTER (WHERE dirigeant.date_naissance IS NOT NULL)::text AS "dirigeantsAgeRenseigne"
         FROM analytics.vw_dossier_portfolio portfolio
         LEFT JOIN entreprise_dirigeants dirigeant
           ON dirigeant.entreprise_id = portfolio.entreprise_id AND dirigeant.dirigeant_principal = TRUE
         WHERE ${dossier.sql}`,
        dossier.values,
      ),
      this.db.query(
        `SELECT portfolio.statut, COUNT(*)::int AS total,
          COALESCE(SUM(portfolio.montant_demande), 0)::text AS "montantDemande"
         FROM analytics.vw_dossier_portfolio portfolio
         WHERE ${dossier.sql}
         GROUP BY portfolio.statut
         ORDER BY COUNT(*) DESC, portfolio.statut ASC`,
        dossier.values,
      ),
      this.db.query<BreakdownRow>(
        `SELECT portfolio.region_id AS id, portfolio.region_nom AS nom,
          COUNT(*)::int AS dossiers,
          COALESCE(SUM(portfolio.montant_demande) FILTER (WHERE portfolio.statut <> 'BROUILLON'), 0)::text AS "montantDemande",
          COALESCE(SUM(portfolio.montant_approuve) FILTER (WHERE portfolio.decision = 'APPROUVE'), 0)::text AS "montantApprouve"
         FROM analytics.vw_dossier_portfolio portfolio
         WHERE ${dossier.sql}
         GROUP BY portfolio.region_id, portfolio.region_nom
         ORDER BY SUM(portfolio.montant_demande) DESC NULLS LAST, portfolio.region_nom ASC`,
        dossier.values,
      ),
      this.db.query<BreakdownRow>(
        `SELECT portfolio.secteur_id AS id, portfolio.secteur_nom AS nom,
          COUNT(*)::int AS dossiers,
          COALESCE(SUM(portfolio.montant_demande), 0)::text AS "montantDemande"
         FROM analytics.vw_dossier_portfolio portfolio
         WHERE ${dossier.sql}
         GROUP BY portfolio.secteur_id, portfolio.secteur_nom
         ORDER BY COUNT(*) DESC, portfolio.secteur_nom ASC`,
        dossier.values,
      ),
      this.db.query<BreakdownRow>(
        `SELECT portfolio.programme_id AS id, portfolio.programme_nom AS nom,
          COUNT(*)::int AS dossiers,
          COALESCE(SUM(portfolio.montant_demande) FILTER (WHERE portfolio.statut <> 'BROUILLON'), 0)::text AS "montantDemande",
          COALESCE(SUM(portfolio.montant_approuve) FILTER (WHERE portfolio.decision = 'APPROUVE'), 0)::text AS "montantApprouve"
         FROM analytics.vw_dossier_portfolio portfolio
         WHERE ${dossier.sql}
         GROUP BY portfolio.programme_id, portfolio.programme_nom
         ORDER BY SUM(portfolio.montant_demande) DESC NULLS LAST, portfolio.programme_nom ASC`,
        dossier.values,
      ),
      this.db.query<BankBreakdownRow>(
        `SELECT financing.banque_partenaire_id AS id,
          COALESCE(financing.banque_nom, 'Sans banque partenaire') AS nom,
          COUNT(*)::int AS financements,
          COALESCE(SUM(financing.montant_decaisse), 0)::text AS "montantDecaisse",
          COALESCE(SUM(financing.montant_rembourse), 0)::text AS "montantRembourse",
          COALESCE(SUM(financing.impaye), 0)::text AS impayes
         FROM analytics.vw_financing_performance financing
         WHERE ${financing.sql}
         GROUP BY financing.banque_partenaire_id, financing.banque_nom
         ORDER BY SUM(financing.montant_decaisse) DESC NULLS LAST, nom ASC`,
        financing.values,
      ),
      this.db.query(
        `SELECT portfolio.dossier_id AS id, portfolio.numero_dossier AS "numeroDossier",
          portfolio.raison_sociale AS "raisonSociale", portfolio.region_nom AS region,
          portfolio.programme_nom AS programme, portfolio.montant_demande AS "montantDemande",
          portfolio.statut, portfolio.score_total AS "scoreTotal",
          portfolio.updated_at AS "updatedAt"
         FROM analytics.vw_dossier_portfolio portfolio
         WHERE ${dossier.sql}
         ORDER BY portfolio.updated_at DESC
         LIMIT 8`,
        dossier.values,
      ),
      this.db.query(`SELECT id, nom FROM regions ORDER BY nom ASC`),
      this.db.query(`SELECT id, nom FROM programmes_fodip WHERE statut = 'ACTIVE' ORDER BY nom ASC`),
      this.db.query(`SELECT id, nom FROM secteurs_activite ORDER BY nom ASC`),
      this.db.query(`SELECT id, raison_sociale AS nom FROM partenaires_bancaires WHERE actif = TRUE ORDER BY raison_sociale ASC`),
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
      financing: financingTotals.rows[0],
      impact: impactTotals.rows[0],
      gender: gender.rows[0],
      youth: youth.rows[0],
      pipeline: pipeline.rows,
      regions: regions.rows,
      sectors: sectors.rows,
      programs: programs.rows,
      banks: banks.rows,
      recentApplications: recentApplications.rows,
      filters: {
        regions: filterRegions.rows,
        programmes: filterProgrammes.rows,
        secteurs: filterSecteurs.rows,
        banques: filterBanques.rows,
      },
      sourceUpdatedAt: freshness.rows[0]?.sourceUpdatedAt ?? null,
    };
  }

  /**
   * The same four core financial totals `dashboard()` returns (montantDemande/montantApprouve/
   * montantDecaisse/montantRembourse), for one explicit [from, to] window rather than the
   * dashboard's own optional filter - used to compute the "période précédente" comparison. Only
   * region/programme/secteur/banque are honoured (the same cross-cutting filters the main
   * dashboard applies); from/to here ARE the window itself, not an additional optional filter.
   */
  async periodTotals(query: DashboardQueryDto, from: string, to: string) {
    const bounded = { ...query, from, to };
    const dossier = dossierFilterFor(bounded, 'portfolio');
    const financing = financingFilterFor(bounded, 'financing');

    const [dossierTotals, financingTotals] = await Promise.all([
      this.db.query<{ montantDemande: string; montantApprouve: string }>(
        `SELECT
          COALESCE(SUM(portfolio.montant_demande) FILTER (WHERE portfolio.statut <> 'BROUILLON'), 0)::text AS "montantDemande",
          COALESCE(SUM(portfolio.montant_approuve) FILTER (WHERE portfolio.decision = 'APPROUVE'), 0)::text AS "montantApprouve"
         FROM analytics.vw_dossier_portfolio portfolio
         WHERE ${dossier.sql}`,
        dossier.values,
      ),
      this.db.query<{ montantDecaisse: string; montantRembourse: string }>(
        `SELECT
          COALESCE(SUM(financing.montant_decaisse), 0)::text AS "montantDecaisse",
          COALESCE(SUM(financing.montant_rembourse), 0)::text AS "montantRembourse"
         FROM analytics.vw_financing_performance financing
         WHERE ${financing.sql}`,
        financing.values,
      ),
    ]);

    return { ...dossierTotals.rows[0], ...financingTotals.rows[0] };
  }

  /**
   * "Points d'attention" (mission section 4) - each query below is a real, independently
   * verifiable condition against the transactional tables, not a placeholder. Two of the
   * mission's eight alert types are deliberately not implemented here yet, honestly, rather than
   * faked against a made-up threshold - see docs/23-PRESENTATION-DIRECTION-GENERALE.md for why
   * ("documents manquants" has no per-programme required-document checklist anywhere in this
   * schema to compute against without inventing one; that's a product decision, not a query).
   */
  async alerts(query: DashboardQueryDto) {
    const financingScope = financingScopeFor(query, 'financing');
    const dossierScope = dossierScopeFor(query, 'portfolio');

    const [overdueInstallments, overdueDisbursements, blockedApplications, staleImpact, overdueByBank] = await Promise.all([
      // 1. Échéances en retard : montant dû à une échéance passée, pas (ou pas totalement) remboursé.
      this.db.query(
        `SELECT COUNT(DISTINCT financing.financement_id)::int AS dossiers, COALESCE(SUM(financing.impaye), 0)::text AS montant
         FROM analytics.vw_financing_performance financing
         WHERE ${financingScope.sql} AND financing.impaye > 0`,
        financingScope.values,
      ),
      // 2. Décaissements planifiés désormais en retard (date_prevue passée, jamais exécutés).
      this.db.query(
        `SELECT COUNT(*)::int AS dossiers, COALESCE(SUM(decaissement.montant), 0)::text AS montant
         FROM decaissements decaissement
         JOIN analytics.vw_financing_performance financing ON financing.financement_id = decaissement.financement_id
         WHERE ${financingScope.sql} AND decaissement.statut = 'PREVU' AND decaissement.date_prevue < CURRENT_DATE`,
        financingScope.values,
      ),
      // 3. Dossiers en instruction depuis plus longtemps que le SLA cible.
      this.db.query(
        `SELECT COUNT(*)::int AS dossiers, COALESCE(SUM(portfolio.montant_demande), 0)::text AS montant
         FROM analytics.vw_dossier_portfolio portfolio
         WHERE ${dossierScope.sql}
           AND portfolio.statut IN ('EN_INSTRUCTION', 'COMPLEMENT_REQUIS')
           AND portfolio.updated_at < NOW() - (${SLA_INSTRUCTION_JOURS} || ' days')::interval`,
        dossierScope.values,
      ),
      // 4. Financements actifs sans suivi d'impact récent (ou aucun suivi du tout).
      this.db.query(
        `SELECT COUNT(*)::int AS dossiers
         FROM analytics.vw_financing_performance financing
         LEFT JOIN LATERAL (
           SELECT MAX(impact.periode) AS derniere_periode
           FROM suivis_impact impact
           WHERE impact.financement_id = financing.financement_id
         ) latest ON TRUE
         WHERE ${financingScope.sql}
           AND financing.statut = 'ACTIF'
           AND (latest.derniere_periode IS NULL OR latest.derniere_periode < CURRENT_DATE - (${IMPACT_STALENESS_MOIS} || ' months')::interval)`,
        financingScope.values,
      ),
      // 5. Le même retard qu'1+2, ventilé par banque partenaire - pour "quelles banques traînent".
      this.db.query<{ id: string | null; nom: string; dossiers: number; montant: string }>(
        `SELECT financing.banque_partenaire_id AS id, COALESCE(financing.banque_nom, 'Sans banque partenaire') AS nom,
          COUNT(DISTINCT financing.financement_id)::int AS dossiers, COALESCE(SUM(financing.impaye), 0)::text AS montant
         FROM analytics.vw_financing_performance financing
         WHERE ${financingScope.sql} AND financing.impaye > 0
         GROUP BY financing.banque_partenaire_id, financing.banque_nom
         ORDER BY SUM(financing.impaye) DESC`,
        financingScope.values,
      ),
    ]);

    return {
      overdueInstallments: overdueInstallments.rows[0],
      overdueDisbursements: overdueDisbursements.rows[0],
      blockedApplications: blockedApplications.rows[0],
      staleImpact: staleImpact.rows[0],
      overdueByBank: overdueByBank.rows,
      thresholds: { slaInstructionJours: SLA_INSTRUCTION_JOURS, impactStalenessMois: IMPACT_STALENESS_MOIS, concentrationSeuilPct: CONCENTRATION_SEUIL_PCT },
    };
  }
}
