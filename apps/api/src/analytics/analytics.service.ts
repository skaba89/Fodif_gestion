import { Injectable } from '@nestjs/common';
import { AnalyticsRepository } from './analytics.repository';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

const numericKeys = [
  'pmeEnregistrees', 'dossiersActifs', 'dossiersDeposes', 'dossiersEnInstruction',
  'dossiersApprouves', 'dossiersRejetes', 'montantDemande', 'montantApprouve',
  'montantDecaisse', 'montantDu', 'montantRembourse', 'impayes', 'emploisCrees',
  'emploisMaintenus', 'chiffreAffaires', 'entreprisesSuivies', 'dirigeantesFemmes',
  'dirigeantsRenseignes', 'dirigeantsJeunes', 'dirigeantsAgeRenseigne', 'dossiers',
  'total', 'scoreTotal', 'financements', 'montant',
];

function normalizeNumbers<T>(value: T): T {
  if (Array.isArray(value)) return value.map(normalizeNumbers) as T;
  if (value instanceof Date) return value;
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      numericKeys.includes(key) && child !== null ? Number(child) : normalizeNumbers(child),
    ]),
  ) as T;
}

type Trend = { deltaPct: number | null; direction: 'up' | 'down' | 'flat' | null };

function trendOf(current: number, previous: number | undefined): Trend {
  if (previous === undefined || previous <= 0) return { deltaPct: null, direction: null };
  const deltaPct = Math.round(((current - previous) / previous) * 1000) / 10;
  const direction = deltaPct > 0.05 ? 'up' : deltaPct < -0.05 ? 'down' : 'flat';
  return { deltaPct, direction };
}

// One immediately-preceding window of the same length as [from, to] - the simplest, least
// surprising definition of "période précédente" for a period a Directeur général picks freely
// (not necessarily a calendar month/quarter), and the same one a "compare to last period" toggle
// in most BI tools uses.
function previousWindow(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T00:00:00Z`);
  const spanDays = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1);
  const previousTo = new Date(fromDate.getTime() - 86_400_000);
  const previousFrom = new Date(previousTo.getTime() - (spanDays - 1) * 86_400_000);
  return { from: previousFrom.toISOString().slice(0, 10), to: previousTo.toISOString().slice(0, 10) };
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly analytics: AnalyticsRepository) {}

  async dashboard(query: DashboardQueryDto) {
    const raw = await this.analytics.dashboard(query);
    const normalized = normalizeNumbers(raw);
    const amountDue = Number(normalized.financing.montantDu);
    const amountRepaid = Number(normalized.financing.montantRembourse);
    const repaymentRate = amountDue > 0
      ? Math.min(100, Math.round((amountRepaid / amountDue) * 1000) / 10)
      : 0;
    // null, not a fabricated 0 %, when nobody in the filtered portfolio has this field recorded
    // at all - "0 % de dirigeantes femmes" and "cette donnée n'est renseignée pour aucune PME de
    // ce périmètre" are two different, non-interchangeable facts, and only one of them is what a
    // rate of 0 informed/0 total actually means. Mission "présentation Directeur général" ("aucune
    // donnée fictive comme une donnée réelle") is explicit that this distinction matters.
    const informedLeaders = Number(normalized.gender.dirigeantsRenseignes);
    const womenLeaders = Number(normalized.gender.dirigeantesFemmes);
    const womenLeaderRate = informedLeaders > 0
      ? Math.round((womenLeaders / informedLeaders) * 1000) / 10
      : null;
    const ageInformedLeaders = Number(normalized.youth.dirigeantsAgeRenseigne);
    const youngLeaders = Number(normalized.youth.dirigeantsJeunes);
    const youngLeaderRate = ageInformedLeaders > 0
      ? Math.round((youngLeaders / ageInformedLeaders) * 1000) / 10
      : null;
    const montantDecaisse = Number(normalized.financing.montantDecaisse);
    const montantRembourse = Number(normalized.financing.montantRembourse);
    const encours = Math.max(0, montantDecaisse - montantRembourse);

    // "Comparaison avec la période précédente" - only computable when the caller actually picked
    // a period (mission: "état indisponible si la donnée manque", not a fabricated 0%). Scoped to
    // the four core financial KPIs, not every KPI on the cockpit: a meaningful trend needs a
    // period-bound total to compare against, which several KPIs here (pmeEnregistrees, a
    // point-in-time headcount; tauxRemboursement, already a ratio) aren't.
    let trends: Record<'montantDemande' | 'montantApprouve' | 'montantDecaisse' | 'montantRembourse', Trend> | null = null;
    if (query.from && query.to) {
      const previous = previousWindow(query.from, query.to);
      const rawPreviousTotals = await this.analytics.periodTotals(query, previous.from, previous.to);
      // normalizeNumbers converts the numeric-looking keys at runtime via its own allowlist, not
      // via a type parameter TypeScript can follow field-by-field - the repository's own return
      // type (raw SQL text columns) is what the compiler sees either way, so the cast below just
      // states what's true after normalization runs, exactly like `normalized` above already does
      // implicitly for `raw`.
      const previousTotals = normalizeNumbers(rawPreviousTotals) as unknown as
        { montantDemande: number; montantApprouve: number; montantDecaisse: number; montantRembourse: number };
      trends = {
        montantDemande: trendOf(Number(normalized.kpis.montantDemande), previousTotals.montantDemande),
        montantApprouve: trendOf(Number(normalized.kpis.montantApprouve), previousTotals.montantApprouve),
        montantDecaisse: trendOf(montantDecaisse, previousTotals.montantDecaisse),
        montantRembourse: trendOf(montantRembourse, previousTotals.montantRembourse),
      };
    }

    const rawAlerts = normalizeNumbers(await this.analytics.alerts(query));
    const alerts = this.buildAlerts(
      rawAlerts,
      normalized.regions.map((region) => ({ nom: region.nom, montantDemande: Number(region.montantDemande) })),
      normalized.programs.map((program) => ({ nom: program.nom, montantDemande: Number(program.montantDemande) })),
    );

    return {
      filters: normalized.filters,
      period: query.from && query.to ? { from: query.from, to: query.to } : null,
      kpis: {
        ...normalized.kpis,
        montantDecaisse,
        montantRembourse,
        encours,
        emploisCrees: normalized.impact.emploisCrees,
        tauxRemboursement: repaymentRate,
        impayes: normalized.financing.impayes,
        tauxDirigeantesFemmes: womenLeaderRate,
        tauxDirigeantsJeunes: youngLeaderRate,
      },
      trends,
      pipeline: normalized.pipeline,
      regions: normalized.regions,
      sectors: normalized.sectors,
      programs: normalized.programs,
      banks: normalized.banks,
      recentApplications: normalized.recentApplications,
      impact: {
        emploisCrees: normalized.impact.emploisCrees,
        emploisMaintenus: normalized.impact.emploisMaintenus,
        chiffreAffaires: normalized.impact.chiffreAffaires,
        entreprisesSuivies: normalized.impact.entreprisesSuivies,
        tauxDirigeantesFemmes: womenLeaderRate,
      },
      alerts,
      freshness: {
        generatedAt: new Date().toISOString(),
        sourceUpdatedAt: normalized.sourceUpdatedAt,
        source: 'PostgreSQL analytics',
      },
    };
  }

  private buildAlerts(
    raw: Awaited<ReturnType<AnalyticsRepository['alerts']>>,
    regions: { nom: string; montantDemande: number }[],
    programs: { nom: string; montantDemande: number }[],
  ) {
    const alerts: {
      id: string; severite: 'critique' | 'attention' | 'info'; titre: string; explication: string;
      dossiers: number; montant: number | null; action: string; lien: string;
    }[] = [];

    if (raw.overdueInstallments.dossiers > 0) {
      alerts.push({
        id: 'echeances-retard', severite: 'critique', titre: 'Échéances de remboursement en retard',
        explication: `${raw.overdueInstallments.dossiers} financement(s) ont des échéances passées non intégralement remboursées.`,
        dossiers: raw.overdueInstallments.dossiers, montant: raw.overdueInstallments.montant,
        action: 'Relancer les bénéficiaires et les banques partenaires concernées.',
        lien: '/direction/financements',
      });
    }
    if (raw.overdueDisbursements.dossiers > 0) {
      alerts.push({
        id: 'decaissements-retard', severite: 'attention', titre: 'Décaissements planifiés non exécutés',
        explication: `${raw.overdueDisbursements.dossiers} décaissement(s) prévu(s) ont dépassé leur date prévue sans être exécutés.`,
        dossiers: raw.overdueDisbursements.dossiers, montant: raw.overdueDisbursements.montant,
        action: 'Vérifier le circuit de décaissement avec la banque partenaire.',
        lien: '/direction/financements',
      });
    }
    if (raw.blockedApplications.dossiers > 0) {
      alerts.push({
        id: 'dossiers-bloques', severite: 'attention', titre: 'Dossiers dépassant le délai d’instruction cible',
        explication: `${raw.blockedApplications.dossiers} dossier(s) en instruction depuis plus de ${raw.thresholds.slaInstructionJours} jours.`,
        dossiers: raw.blockedApplications.dossiers, montant: raw.blockedApplications.montant,
        action: 'Prioriser leur traitement auprès des agents et du comité.',
        lien: '/direction/tableau-de-bord#pipeline',
      });
    }
    if (raw.staleImpact.dossiers > 0) {
      alerts.push({
        id: 'impact-non-actualise', severite: 'info', titre: 'Suivis d’impact non actualisés',
        explication: `${raw.staleImpact.dossiers} financement(s) actif(s) sans suivi d’impact depuis plus de ${raw.thresholds.impactStalenessMois} mois.`,
        dossiers: raw.staleImpact.dossiers, montant: null,
        action: 'Relancer la collecte de données d’impact auprès des agents.',
        lien: '/direction/tableau-de-bord#impact',
      });
    }
    for (const bank of raw.overdueByBank as unknown as { id: string | null; nom: string; dossiers: number; montant: number }[]) {
      if (bank.dossiers > 0 && bank.montant > 0) {
        alerts.push({
          id: `banque-retard-${bank.id ?? 'sans-banque'}`, severite: 'attention',
          titre: `Retards concentrés chez ${bank.nom}`,
          explication: `${bank.dossiers} financement(s) en retard de remboursement chez ce partenaire bancaire.`,
          dossiers: bank.dossiers, montant: bank.montant,
          action: 'Programmer un point de suivi avec ce partenaire bancaire.',
          lien: '/direction/financements',
        });
      }
    }

    const totalRegionAmount = regions.reduce((sum, region) => sum + region.montantDemande, 0);
    const topRegion = [...regions].sort((a, b) => b.montantDemande - a.montantDemande)[0];
    if (topRegion && totalRegionAmount > 0) {
      const share = Math.round((topRegion.montantDemande / totalRegionAmount) * 1000) / 10;
      if (share > raw.thresholds.concentrationSeuilPct) {
        alerts.push({
          id: 'concentration-region', severite: 'info', titre: `Concentration régionale élevée : ${topRegion.nom}`,
          explication: `${share} % du montant demandé provient d’une seule région (seuil de vigilance : ${raw.thresholds.concentrationSeuilPct} %).`,
          dossiers: 0, montant: null, action: 'Évaluer l’équilibre territorial des prochaines campagnes.',
          lien: '/direction/tableau-de-bord#regions',
        });
      }
    }
    const totalProgramAmount = programs.reduce((sum, program) => sum + program.montantDemande, 0);
    const topProgram = [...programs].sort((a, b) => b.montantDemande - a.montantDemande)[0];
    if (topProgram && totalProgramAmount > 0) {
      const share = Math.round((topProgram.montantDemande / totalProgramAmount) * 1000) / 10;
      if (share > raw.thresholds.concentrationSeuilPct) {
        alerts.push({
          id: 'concentration-programme', severite: 'info', titre: `Concentration élevée sur le programme : ${topProgram.nom}`,
          explication: `${share} % du montant demandé provient d’un seul programme (seuil de vigilance : ${raw.thresholds.concentrationSeuilPct} %).`,
          dossiers: 0, montant: null, action: 'Évaluer la diversification du portefeuille de programmes.',
          lien: '/direction/tableau-de-bord#programmes',
        });
      }
    }

    const severityOrder = { critique: 0, attention: 1, info: 2 };
    return alerts.sort((a, b) => severityOrder[a.severite] - severityOrder[b.severite]);
  }
}
