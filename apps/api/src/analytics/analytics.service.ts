import { Injectable } from '@nestjs/common';
import { AnalyticsRepository } from './analytics.repository';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

const numericKeys = [
  'pmeEnregistrees', 'dossiersActifs', 'montantDemande', 'montantApprouve',
  'montantDecaisse', 'montantDu', 'montantRembourse', 'impayes', 'emploisCrees',
  'emploisMaintenus', 'chiffreAffaires', 'entreprisesSuivies', 'dirigeantesFemmes',
  'dirigeantsRenseignes', 'dossiers', 'total', 'scoreTotal',
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
    const informedLeaders = Number(normalized.gender.dirigeantsRenseignes);
    const womenLeaders = Number(normalized.gender.dirigeantesFemmes);
    const womenLeaderRate = informedLeaders > 0
      ? Math.round((womenLeaders / informedLeaders) * 1000) / 10
      : 0;

    return {
      filters: normalized.filters,
      kpis: {
        ...normalized.kpis,
        montantDecaisse: normalized.financing.montantDecaisse,
        emploisCrees: normalized.impact.emploisCrees,
        tauxRemboursement: repaymentRate,
        impayes: normalized.financing.impayes,
      },
      pipeline: normalized.pipeline,
      regions: normalized.regions,
      sectors: normalized.sectors,
      recentApplications: normalized.recentApplications,
      impact: {
        emploisCrees: normalized.impact.emploisCrees,
        emploisMaintenus: normalized.impact.emploisMaintenus,
        chiffreAffaires: normalized.impact.chiffreAffaires,
        entreprisesSuivies: normalized.impact.entreprisesSuivies,
        tauxDirigeantesFemmes: womenLeaderRate,
      },
      freshness: {
        generatedAt: new Date().toISOString(),
        sourceUpdatedAt: normalized.sourceUpdatedAt,
        source: 'PostgreSQL analytics',
      },
    };
  }
}
