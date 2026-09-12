import { readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';

type PortalId = 'entrepreneur' | 'agent' | 'comite' | 'direction' | 'administration' | 'auditeur' | 'partenaire';
type RouteCase = { source: string; sample: string; expected?: string };
type RoleCase = {
  role: string;
  roleLabel: string;
  email: string;
  portal: PortalId;
  home: string;
  forbidden: string;
  canReadNotifications?: boolean;
};

const DEMO_PASSWORD = 'FodipDemo2026!';
const APP_DIR = path.resolve(process.cwd(), 'app');
const CLIENT_REDIRECT_TIMEOUT_MS = 15_000;

const PUBLIC_ROUTES = [
  '/', '/accessibilite', '/assistance', '/confidentialite', '/connexion', '/design-system', '/hors-ligne', '/mentions-legales',
] as const;
const SHARED_AUTH_ROUTES = ['/mes-donnees', '/notifications', '/profil'] as const;
const LEGACY_LOGIN_ROUTES = [
  '/administration/connexion',
  '/agent/connexion',
  '/auditeur/connexion',
  '/comite/connexion',
  '/direction/connexion',
  '/entrepreneur/connexion',
  '/partenaire/connexion',
] as const;

const PORTAL_ROUTES: Record<PortalId, RouteCase[]> = {
  administration: [
    { source: '/administration/recuperation', sample: '/administration/recuperation' },
    { source: '/administration/utilisateurs', sample: '/administration/utilisateurs' },
  ],
  agent: [
    { source: '/agent', sample: '/agent', expected: '/agent/tableau-de-bord' },
    { source: '/agent/tableau-de-bord', sample: '/agent/tableau-de-bord' },
    { source: '/agent/dossiers', sample: '/agent/dossiers' },
    {
      source: '/agent/dossiers/[id]',
      sample: '/agent/dossiers/60000000-0000-4000-8000-000000000002',
    },
    { source: '/agent/programmes', sample: '/agent/programmes' },
  ],
  auditeur: [
    { source: '/auditeur', sample: '/auditeur', expected: '/auditeur/tableau-de-bord' },
    { source: '/auditeur/programmes', sample: '/auditeur/programmes' },
    { source: '/auditeur/tableau-de-bord', sample: '/auditeur/tableau-de-bord' },
  ],
  comite: [
    { source: '/comite', sample: '/comite', expected: '/comite/tableau-de-bord' },
    { source: '/comite/tableau-de-bord', sample: '/comite/tableau-de-bord' },
    { source: '/comite/dossiers', sample: '/comite/dossiers', expected: '/comite/dossiers?vue=ORDRE_DU_JOUR' },
    {
      source: '/comite/dossiers/[id]',
      sample: '/comite/dossiers/60000000-0000-4000-8000-000000000005',
    },
    { source: '/comite/programmes', sample: '/comite/programmes' },
  ],
  direction: [
    { source: '/direction/financements', sample: '/direction/financements' },
    {
      source: '/direction/financements/[id]',
      sample: '/direction/financements/80000000-0000-4000-8000-000000000001',
    },
    { source: '/direction/programmes', sample: '/direction/programmes' },
    { source: '/direction/rapprochements', sample: '/direction/rapprochements' },
    { source: '/direction/tableau-de-bord', sample: '/direction/tableau-de-bord' },
  ],
  entrepreneur: [
    { source: '/entrepreneur', sample: '/entrepreneur' },
    { source: '/entrepreneur/demande', sample: '/entrepreneur/demande' },
    { source: '/entrepreneur/entreprise', sample: '/entrepreneur/entreprise' },
    { source: '/entrepreneur/programmes', sample: '/entrepreneur/programmes' },
    { source: '/entrepreneur/suivi', sample: '/entrepreneur/suivi' },
    {
      source: '/entrepreneur/suivi/[id]/documents',
      sample: '/entrepreneur/suivi/60000000-0000-4000-8000-000000000003/documents',
    },
  ],
  partenaire: [
    { source: '/partenaire', sample: '/partenaire', expected: '/partenaire/financements' },
    { source: '/partenaire/financements', sample: '/partenaire/financements' },
    {
      source: '/partenaire/financements/[id]',
      sample: '/partenaire/financements/80000000-0000-4000-8000-000000000001',
    },
  ],
};

const ROLE_CASES: RoleCase[] = [
  {
    role: 'PME', roleLabel: 'PME', email: 'qualification-pme@fodip.local', portal: 'entrepreneur',
    home: '/entrepreneur', forbidden: '/direction/tableau-de-bord',
  },
  {
    role: 'AGENT_FODIP', roleLabel: 'Agent FODIP', email: 'qualification-agent@fodip.local', portal: 'agent',
    home: '/agent/tableau-de-bord', forbidden: '/partenaire/financements',
  },
  {
    role: 'COMITE_FINANCEMENT', roleLabel: 'Comité de financement', email: 'qualification-comite@fodip.local', portal: 'comite',
    home: '/comite/tableau-de-bord', forbidden: '/administration/utilisateurs',
  },
  {
    role: 'DIRECTION_FODIP', roleLabel: 'Direction FODIP', email: 'qualification-direction@fodip.local', portal: 'direction',
    home: '/direction/tableau-de-bord', forbidden: '/entrepreneur',
  },
  {
    role: 'ANALYSTE', roleLabel: 'Analyste', email: 'qualification-analyste@fodip.local', portal: 'direction',
    home: '/direction/tableau-de-bord', forbidden: '/administration/utilisateurs',
  },
  {
    role: 'AUDITEUR', roleLabel: 'Auditeur', email: 'qualification-auditeur@fodip.local', portal: 'auditeur',
    home: '/auditeur/tableau-de-bord', forbidden: '/partenaire/financements',
  },
  {
    role: 'PARTENAIRE_BANCAIRE', roleLabel: 'Partenaire bancaire', email: 'qualification-partenaire@fodip.local', portal: 'partenaire',
    home: '/partenaire/financements', forbidden: '/direction/tableau-de-bord', canReadNotifications: false,
  },
  {
    role: 'SUPER_ADMIN', roleLabel: 'Super administrateur', email: 'qualification-admin@fodip.local', portal: 'administration',
    home: '/administration/utilisateurs', forbidden: '/entrepreneur',
  },
];

function discoverPageRoutes(directory: string, relative = ''): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!relative && entry.name === 'api') continue;
      routes.push(...discoverPageRoutes(path.join(directory, entry.name), path.join(relative, entry.name)));
      continue;
    }
    if (entry.name !== 'page.tsx') continue;
    const normalized = relative.split(path.sep).filter(Boolean).join('/');
    routes.push(normalized ? `/${normalized}` : '/');
  }
  return routes.sort();
}

function allDeclaredRoutes() {
  return [
    ...PUBLIC_ROUTES,
    ...SHARED_AUTH_ROUTES,
    ...LEGACY_LOGIN_ROUTES,
    ...Object.values(PORTAL_ROUTES).flat().map((route) => route.source),
  ].sort();
}

function pathPattern(value: string) {
  return new RegExp(`${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

async function login(page: Page, roleCase: RoleCase) {
  await page.goto('/connexion');
  await page.getByLabel('Email').fill(roleCase.email);
  await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(pathPattern(roleCase.home));
}

async function expectHealthyPage(page: Page, route: RouteCase, apiErrors: string[]) {
  const before = apiErrors.length;
  await page.goto(route.sample);
  await expect(page).toHaveURL(pathPattern(route.expected ?? route.sample));
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  expect(apiErrors.slice(before), `${route.sample} returned failing API responses`).toEqual([]);
}

test.describe('Exhaustive route and role qualification', () => {
  test('every Next.js page has an explicit qualification policy', () => {
    expect(discoverPageRoutes(APP_DIR)).toEqual(allDeclaredRoutes());
  });

  test('every public and legacy-login page is reachable without a session', async ({ context }) => {
    test.setTimeout(120_000);
    for (const route of PUBLIC_ROUTES) {
      const routePage = await context.newPage();
      try {
        const response = await routePage.goto(route);
        expect(response?.status(), `${route} must not fail`).toBeLessThan(400);
        await expect(routePage.locator('body')).toBeVisible();
      } finally {
        await routePage.close();
      }
    }
    for (const route of LEGACY_LOGIN_ROUTES) {
      const routePage = await context.newPage();
      try {
        await routePage.goto(route);
        await expect(routePage).toHaveURL(/\/connexion$/, { timeout: CLIENT_REDIRECT_TIMEOUT_MS });
        await expect(routePage.getByRole('heading', { name: 'Connexion FODIP', exact: true })).toBeVisible();
      } finally {
        await routePage.close();
      }
    }
  });

  test('every protected page rejects an unauthenticated browser', async ({ context }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'The shared session guard is engine- and viewport-independent.');
    test.setTimeout(120_000);
    await context.clearCookies();
    const samples = [
      ...SHARED_AUTH_ROUTES,
      ...Object.values(PORTAL_ROUTES).flat().map((route) => route.sample),
    ];
    for (const route of samples) {
      const routePage = await context.newPage();
      try {
        await routePage.goto(route);
        await expect(routePage, `${route} must require authentication`).toHaveURL(
          /\/connexion(?:\?reason=session-expired)?$/,
          { timeout: CLIENT_REDIRECT_TIMEOUT_MS },
        );
      } finally {
        await routePage.close();
      }
    }
  });

  for (const roleCase of ROLE_CASES) {
    test(`${roleCase.role} reaches its authorized pages, shared account pages and is rejected by a forbidden portal`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);

      await login(page, roleCase);

      const apiErrors: string[] = [];
      page.on('response', (response) => {
        const url = new URL(response.url());
        if (url.pathname.startsWith('/api/') && response.status() >= 400) {
          apiErrors.push(`${response.status()} ${url.pathname}`);
        }
      });

      const isMobileQualification = testInfo.project.name === 'Pixel 7' || testInfo.project.name === 'iPhone 14';
      const routes = isMobileQualification
        ? PORTAL_ROUTES[roleCase.portal].filter((route) => (route.expected ?? route.sample) === roleCase.home)
        : PORTAL_ROUTES[roleCase.portal];

      for (const route of routes) await expectHealthyPage(page, route, apiErrors);

      await page.goto('/profil');
      await expect(page).toHaveURL(/\/profil$/);
      await expect(page.getByRole('heading', { name: 'Mon profil' })).toBeVisible();
      await expect(page.getByTestId('profile-email')).toHaveText(roleCase.email);
      await expect(page.getByTestId('profile-roles')).toContainText(roleCase.roleLabel);

      if (roleCase.canReadNotifications !== false) {
        await page.goto('/notifications');
        await expect(page).toHaveURL(/\/notifications$/);
        await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
      }

      if (!isMobileQualification) {
        await page.goto('/mes-donnees');
        await expect(page).toHaveURL(/\/mes-donnees$/);
        await expect(page.getByRole('heading', { name: 'Mes données personnelles' })).toBeVisible();
      }

      expect(apiErrors, `${roleCase.role} must not receive failing API responses on authorized/shared pages`).toEqual([]);

      await page.goto(roleCase.forbidden);
      await expect(page, `${roleCase.role} must be redirected away from ${roleCase.forbidden}`).toHaveURL(pathPattern(roleCase.home));
    });
  }
});
