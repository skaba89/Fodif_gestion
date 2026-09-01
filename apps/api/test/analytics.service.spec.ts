import { AnalyticsRepository } from '../src/analytics/analytics.repository';
import { AnalyticsService } from '../src/analytics/analytics.service';

describe('AnalyticsService', () => {
  it('normalizes PostgreSQL numbers and derives documented rates', async () => {
    const repository = {
      dashboard: jest.fn().mockResolvedValue({
        kpis: { pmeEnregistrees: '4', dossiersActifs: '3', montantDemande: '2360000000', montantApprouve: '550000000' },
        financing: { montantDecaisse: '400000000', montantDu: '100000000', montantRembourse: '60000000', impayes: '40000000' },
        impact: { emploisCrees: '12', emploisMaintenus: '40', chiffreAffaires: '4850000000', entreprisesSuivies: '2' },
        gender: { dirigeantesFemmes: '2', dirigeantsRenseignes: '4' },
        pipeline: [{ statut: 'SOUMIS', total: 1, montantDemande: '750000000' }],
        regions: [{ id: 'r1', nom: 'Conakry', dossiers: 3, montantDemande: '1450000000', montantApprouve: '0' }],
        sectors: [{ id: 's1', nom: 'Agro-industrie', dossiers: 4, montantDemande: '2050000000' }],
        recentApplications: [{ id: 'd1', scoreTotal: '72.5', montantDemande: '750000000' }],
        filters: { regions: [], programmes: [] },
        sourceUpdatedAt: new Date('2026-09-01T10:00:00.000Z'),
      }),
    } as unknown as AnalyticsRepository;
    const service = new AnalyticsService(repository);

    const result = await service.dashboard({});

    expect(result.kpis.pmeEnregistrees).toBe(4);
    expect(result.kpis.montantDecaisse).toBe(400000000);
    expect(result.kpis.tauxRemboursement).toBe(60);
    expect(result.impact.tauxDirigeantesFemmes).toBe(50);
    expect(result.recentApplications[0].scoreTotal).toBe(72.5);
    expect(result.freshness.sourceUpdatedAt).toEqual(new Date('2026-09-01T10:00:00.000Z'));
    expect(result.freshness.source).toBe('PostgreSQL analytics');
  });

  it('returns a zero repayment rate when no installment is due', async () => {
    const repository = {
      dashboard: jest.fn().mockResolvedValue({
        kpis: {}, financing: { montantDecaisse: '0', montantDu: '0', montantRembourse: '0', impayes: '0' },
        impact: { emploisCrees: '0', emploisMaintenus: '0', chiffreAffaires: '0', entreprisesSuivies: '0' },
        gender: { dirigeantesFemmes: '0', dirigeantsRenseignes: '0' },
        pipeline: [], regions: [], sectors: [], recentApplications: [],
        filters: { regions: [], programmes: [] }, sourceUpdatedAt: null,
      }),
    } as unknown as AnalyticsRepository;

    const result = await new AnalyticsService(repository).dashboard({});

    expect(result.kpis.tauxRemboursement).toBe(0);
    expect(result.impact.tauxDirigeantesFemmes).toBe(0);
  });
});
