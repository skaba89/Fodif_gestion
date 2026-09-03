import { AnalyticsRepository } from '../src/analytics/analytics.repository';
import { AnalyticsService } from '../src/analytics/analytics.service';

// Minimal-but-complete fixture matching AnalyticsRepository.dashboard()'s real return shape -
// every field the service reads, so a test only overrides what it's actually exercising.
function dashboardFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    kpis: {
      pmeEnregistrees: '4', dossiersActifs: '3', dossiersDeposes: '5', dossiersEnInstruction: '2',
      dossiersApprouves: '1', dossiersRejetes: '0', montantDemande: '2360000000', montantApprouve: '550000000',
    },
    financing: { montantDecaisse: '400000000', montantDu: '100000000', montantRembourse: '60000000', impayes: '40000000' },
    impact: { emploisCrees: '12', emploisMaintenus: '40', chiffreAffaires: '4850000000', entreprisesSuivies: '2' },
    gender: { dirigeantesFemmes: '2', dirigeantsRenseignes: '4' },
    youth: { dirigeantsJeunes: '1', dirigeantsAgeRenseigne: '4' },
    pipeline: [{ statut: 'SOUMIS', total: 1, montantDemande: '750000000' }],
    // Three regions/programs, evenly split (~33% each - below the 40% concentration threshold),
    // by default - so tests that don't care about concentration alerts don't accidentally trigger
    // one just by using a fixture with too few entries (two entries can never be "balanced" under
    // a 40% threshold - the smaller of two even shares is already 50%). The concentration-specific
    // tests below override these with a deliberately skewed split.
    regions: [
      { id: 'r1', nom: 'Conakry', dossiers: 2, montantDemande: '483333333', montantApprouve: '0' },
      { id: 'r2', nom: 'Kankan', dossiers: 2, montantDemande: '483333333', montantApprouve: '0' },
      { id: 'r3', nom: 'Labé', dossiers: 1, montantDemande: '483333334', montantApprouve: '0' },
    ],
    sectors: [{ id: 's1', nom: 'Agro-industrie', dossiers: 4, montantDemande: '2050000000' }],
    programs: [
      { id: 'p1', nom: 'Programme A', dossiers: 2, montantDemande: '786666666', montantApprouve: '0' },
      { id: 'p2', nom: 'Programme B', dossiers: 2, montantDemande: '786666666', montantApprouve: '0' },
      { id: 'p3', nom: 'Programme C', dossiers: 1, montantDemande: '786666668', montantApprouve: '0' },
    ],
    banks: [{ id: 'b1', nom: 'Banque A', financements: 2, montantDecaisse: '400000000', montantRembourse: '60000000', impayes: '40000000' }],
    recentApplications: [{ id: 'd1', scoreTotal: '72.5', montantDemande: '750000000' }],
    filters: { regions: [], programmes: [], secteurs: [], banques: [] },
    sourceUpdatedAt: new Date('2026-09-01T10:00:00.000Z'),
    ...overrides,
  };
}

const emptyAlerts: {
  overdueInstallments: { dossiers: number; montant: string };
  overdueDisbursements: { dossiers: number; montant: string };
  blockedApplications: { dossiers: number; montant: string };
  staleImpact: { dossiers: number };
  overdueByBank: { id: string; nom: string; dossiers: number; montant: string }[];
  thresholds: { slaInstructionJours: number; impactStalenessMois: number; concentrationSeuilPct: number };
} = {
  overdueInstallments: { dossiers: 0, montant: '0' },
  overdueDisbursements: { dossiers: 0, montant: '0' },
  blockedApplications: { dossiers: 0, montant: '0' },
  staleImpact: { dossiers: 0 },
  overdueByBank: [],
  thresholds: { slaInstructionJours: 15, impactStalenessMois: 12, concentrationSeuilPct: 40 },
};

function makeRepository(dashboardOverrides: Partial<Record<string, unknown>> = {}, alerts = emptyAlerts) {
  return {
    dashboard: jest.fn().mockResolvedValue(dashboardFixture(dashboardOverrides)),
    alerts: jest.fn().mockResolvedValue(alerts),
    periodTotals: jest.fn(),
  } as unknown as AnalyticsRepository;
}

describe('AnalyticsService', () => {
  it('normalizes PostgreSQL numbers and derives documented rates', async () => {
    const repository = makeRepository();
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

  it('returns a zero repayment rate when no installment is due, but null (not a fabricated 0 %) for gender/youth rates with nothing recorded', async () => {
    const repository = makeRepository({
      kpis: {}, financing: { montantDecaisse: '0', montantDu: '0', montantRembourse: '0', impayes: '0' },
      impact: { emploisCrees: '0', emploisMaintenus: '0', chiffreAffaires: '0', entreprisesSuivies: '0' },
      gender: { dirigeantesFemmes: '0', dirigeantsRenseignes: '0' },
      youth: { dirigeantsJeunes: '0', dirigeantsAgeRenseigne: '0' },
      pipeline: [], regions: [], sectors: [], programs: [], banks: [], recentApplications: [],
      sourceUpdatedAt: null,
    });

    const result = await new AnalyticsService(repository).dashboard({});

    // tauxRemboursement is a ratio of amounts, not a "how many records have this field" rate -
    // 0 due really does mean a 0% repayment rate is the correct answer, not "no data".
    expect(result.kpis.tauxRemboursement).toBe(0);
    // Zero PME with a recorded genre/date_naissance in this filtered periemeter is "we don't
    // know", not "0% are women/young" - see the service's own comment on why this distinction
    // is deliberate.
    expect(result.impact.tauxDirigeantesFemmes).toBeNull();
    expect(result.kpis.tauxDirigeantsJeunes).toBeNull();
  });

  it('computes encours as montantDecaisse minus montantRembourse, floored at zero', async () => {
    const result = await new AnalyticsService(makeRepository()).dashboard({});
    expect(result.kpis.encours).toBe(400000000 - 60000000);
  });

  it('never returns a negative encours even if remboursements somehow exceed decaissements', async () => {
    const repository = makeRepository({ financing: { montantDecaisse: '100', montantDu: '0', montantRembourse: '150', impayes: '0' } });
    const result = await new AnalyticsService(repository).dashboard({});
    expect(result.kpis.encours).toBe(0);
  });

  it('exposes the youth-leader rate the same way as the women-leader rate', async () => {
    const result = await new AnalyticsService(makeRepository()).dashboard({});
    expect(result.kpis.tauxDirigeantsJeunes).toBe(25); // 1/4
  });

  it('passes through the new dossier-count KPIs and the programs/banks breakdowns untouched', async () => {
    const result = await new AnalyticsService(makeRepository()).dashboard({});
    expect(result.kpis.dossiersDeposes).toBe(5);
    expect(result.kpis.dossiersEnInstruction).toBe(2);
    expect(result.kpis.dossiersApprouves).toBe(1);
    expect(result.programs[0].nom).toBe('Programme A');
    expect(result.banks[0].nom).toBe('Banque A');
  });

  describe('trends (comparaison à la période précédente)', () => {
    it('is null for every metric when no period filter is given', async () => {
      const result = await new AnalyticsService(makeRepository()).dashboard({});
      expect(result.trends).toBeNull();
      expect(result.period).toBeNull();
    });

    it('computes a percentage delta against the immediately preceding window of equal length when a period is given', async () => {
      const repository = makeRepository();
      (repository.periodTotals as jest.Mock).mockResolvedValue({
        montantDemande: '1000000000', montantApprouve: '500000000', montantDecaisse: '200000000', montantRembourse: '30000000',
      });

      const result = await new AnalyticsService(repository).dashboard({ from: '2026-02-01', to: '2026-02-28' });

      expect(repository.periodTotals).toHaveBeenCalledWith({ from: '2026-02-01', to: '2026-02-28' }, '2026-01-04', '2026-01-31');
      expect(result.period).toEqual({ from: '2026-02-01', to: '2026-02-28' });
      // (2 360 000 000 - 1 000 000 000) / 1 000 000 000 = 136%
      expect(result.trends?.montantDemande).toEqual({ deltaPct: 136, direction: 'up' });
      expect(result.trends?.montantDecaisse.direction).toBe('up');
    });

    it('reports an unavailable trend (not a fabricated 0%/Infinity) when the previous period had zero activity', async () => {
      const repository = makeRepository();
      (repository.periodTotals as jest.Mock).mockResolvedValue({
        montantDemande: '0', montantApprouve: '0', montantDecaisse: '0', montantRembourse: '0',
      });

      const result = await new AnalyticsService(repository).dashboard({ from: '2026-02-01', to: '2026-02-28' });

      expect(result.trends?.montantDemande).toEqual({ deltaPct: null, direction: null });
    });
  });

  describe('alerts (points d’attention)', () => {
    it('produces no alert at all when every underlying condition is clean', async () => {
      const result = await new AnalyticsService(makeRepository()).dashboard({});
      expect(result.alerts).toEqual([]);
    });

    it('surfaces overdue installments as a critical alert with the real count and amount', async () => {
      const repository = makeRepository({}, { ...emptyAlerts, overdueInstallments: { dossiers: 3, montant: '15000000' } });
      const result = await new AnalyticsService(repository).dashboard({});
      const alert = result.alerts.find((entry) => entry.id === 'echeances-retard');
      expect(alert).toMatchObject({ severite: 'critique', dossiers: 3, montant: 15000000 });
    });

    it('surfaces one alert per bank with a real overdue balance, skipping banks with nothing overdue', async () => {
      const repository = makeRepository({}, {
        ...emptyAlerts,
        overdueByBank: [
          { id: 'b1', nom: 'Banque A', dossiers: 2, montant: '5000000' },
          { id: 'b2', nom: 'Banque B', dossiers: 0, montant: '0' },
        ],
      });
      const result = await new AnalyticsService(repository).dashboard({});
      expect(result.alerts.filter((entry) => entry.id.startsWith('banque-retard-'))).toHaveLength(1);
      expect(result.alerts.find((entry) => entry.id === 'banque-retard-b1')?.montant).toBe(5000000);
    });

    it('flags regional concentration above the threshold, computed from the real regions breakdown', async () => {
      const repository = makeRepository({
        regions: [
          { id: 'r1', nom: 'Conakry', dossiers: 8, montantDemande: '900000000' },
          { id: 'r2', nom: 'Kankan', dossiers: 2, montantDemande: '100000000' },
        ],
      });
      const result = await new AnalyticsService(repository).dashboard({});
      const alert = result.alerts.find((entry) => entry.id === 'concentration-region');
      expect(alert?.titre).toContain('Conakry');
      expect(alert?.explication).toContain('90 %');
    });

    it('does not flag concentration when the portfolio is reasonably spread out', async () => {
      const repository = makeRepository({
        regions: [
          { id: 'r1', nom: 'Conakry', dossiers: 4, montantDemande: '340000000' },
          { id: 'r2', nom: 'Kankan', dossiers: 3, montantDemande: '330000000' },
          { id: 'r3', nom: 'Labé', dossiers: 3, montantDemande: '330000000' },
        ],
      });
      const result = await new AnalyticsService(repository).dashboard({});
      expect(result.alerts.find((entry) => entry.id === 'concentration-region')).toBeUndefined();
    });

    it('orders alerts critique before attention before info', async () => {
      const repository = makeRepository(
        {
          // Balanced regions/programs (three-way, below the 40% concentration threshold) on
          // purpose - isolates this test to exactly the three triggered conditions below, none
          // of them a concentration alert.
          regions: [
            { id: 'r1', nom: 'Conakry', dossiers: 1, montantDemande: '340' },
            { id: 'r2', nom: 'Kankan', dossiers: 1, montantDemande: '330' },
            { id: 'r3', nom: 'Labé', dossiers: 1, montantDemande: '330' },
          ],
          programs: [
            { id: 'p1', nom: 'Programme A', dossiers: 1, montantDemande: '340' },
            { id: 'p2', nom: 'Programme B', dossiers: 1, montantDemande: '330' },
            { id: 'p3', nom: 'Programme C', dossiers: 1, montantDemande: '330' },
          ],
        },
        {
          ...emptyAlerts,
          staleImpact: { dossiers: 1 },
          overdueInstallments: { dossiers: 1, montant: '1000' },
          blockedApplications: { dossiers: 1, montant: '1000' },
        },
      );
      const result = await new AnalyticsService(repository).dashboard({});
      expect(result.alerts.map((entry) => entry.severite)).toEqual(['critique', 'attention', 'info']);
    });
  });
});
