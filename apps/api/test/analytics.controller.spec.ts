import { AnalyticsController } from '../src/analytics/analytics.controller';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { MissingDocumentsAlertService } from '../src/analytics/missing-documents-alert.service';

function dashboardFixture() {
  return {
    alerts: [
      {
        id: 'impact-non-actualise',
        severite: 'info' as const,
        titre: 'Suivis d’impact non actualisés',
        explication: '1 financement concerné.',
        dossiers: 1,
        montant: null,
        action: 'Relancer la collecte.',
        lien: '/direction/tableau-de-bord#impact',
      },
    ],
  };
}

describe('AnalyticsController', () => {
  it('adds the documentary alert and preserves executive severity ordering', async () => {
    const analytics = {
      dashboard: jest.fn().mockResolvedValue(dashboardFixture()),
    } as unknown as AnalyticsService;
    const missingDocuments = {
      build: jest.fn().mockResolvedValue({
        id: 'documents-manquants',
        severite: 'attention',
        titre: 'Dossiers avec pièces obligatoires manquantes',
        explication: '2 dossiers concernés.',
        dossiers: 2,
        montant: 1_100_000,
        action: 'Régulariser les pièces.',
        lien: '/direction/tableau-de-bord#pipeline',
      }),
    } as unknown as MissingDocumentsAlertService;
    const controller = new AnalyticsController(analytics, missingDocuments);

    const query = { programmeId: '40000000-0000-4000-8000-000000000001' };
    const result = await controller.dashboard(query);

    expect(analytics.dashboard).toHaveBeenCalledWith(query);
    expect(missingDocuments.build).toHaveBeenCalledWith(query);
    expect(result.alerts.map((alert) => alert.id)).toEqual(['documents-manquants', 'impact-non-actualise']);
  });

  it('returns the original dashboard unchanged when no documentary alert exists', async () => {
    const dashboard = dashboardFixture();
    const analytics = { dashboard: jest.fn().mockResolvedValue(dashboard) } as unknown as AnalyticsService;
    const missingDocuments = { build: jest.fn().mockResolvedValue(null) } as unknown as MissingDocumentsAlertService;
    const controller = new AnalyticsController(analytics, missingDocuments);

    const result = await controller.dashboard({});

    expect(result).toBe(dashboard);
  });
});
