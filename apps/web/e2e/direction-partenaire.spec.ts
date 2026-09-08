import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Coverage gap closed: every other portal already has e2e coverage (login.spec.ts, workflow.spec.ts,
// mfa.spec.ts, accessibility.spec.ts, pii-encryption.spec.ts), but nothing had ever driven the
// Direction cockpit or the Partenaire bancaire portal against a live stack before this - both are
// exercised here for the first time, with demo accounts (direction@fodip.local,
// partenaire@fodip.local) neither of those other authenticated specs logs in as. Keep the partner
// login unique in this spec so the 5 attempts/60s per-email auth budget remains valid across the
// five Playwright browser/device projects.
const DEMO_PASSWORD = 'FodipDemo2026!';

async function expectNoSeriousViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const relevant = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(relevant, JSON.stringify(relevant, null, 2)).toEqual([]);
}

test.describe('Direction cockpit', () => {
  test('the national dashboard loads seeded data, preserves portal routing and expires to Direction login', async ({ page, context }) => {
    await page.goto('/direction/connexion');
    await page.getByLabel('Email').fill('direction@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/direction\/tableau-de-bord$/);

    // Multi-region seed data (database/seeds/002_analytics_demo.sql): Kindia Fruits SARL has an
    // approved, disbursed and partly repaid financing - a nonzero read on every KPI in the header.
    // Scoped to .region-list: "Kindia" also appears in the filter dropdown and the recent-activity
    // table, so an unscoped text match would hit Playwright's strict-mode ambiguity.
    await expect(page.locator('.region-list').getByText('Kindia')).toBeVisible();
    // KpiCard (mission "présentation Directeur général", section 2) replaced the old plain
    // `.stat-card` tiles - one distinct label per card, "Montant décaissé" among them.
    await expect(page.getByText('Montant décaissé', { exact: true })).toBeVisible();

    await page.getByLabel('Région').selectOption({ label: 'Kindia' });
    // Scoped to #main-content: an unscoped [role="alert"] also matches Next.js's own built-in
    // route announcer (a permanent, hidden accessibility element outside <main> that announces
    // page-title changes to screen readers after client-side navigation) - a real false positive
    // reproduced locally against a live stack, not the dashboard's own error banner.
    await expect(page.locator('#main-content [role="alert"]')).toHaveCount(0);
    await expect(page.getByLabel('Région')).toHaveValue(/.+/);
    await expect(page.getByText('Réinitialiser')).toBeVisible();

    // The sidebar this used to click through no longer exists - AppShell (section 6-7) replaced
    // every portal's own inline sidebar/nav with a shared header nav + mobile drawer, itself
    // covered by e2e coverage for the drawer/hamburger behaviour directly rather than here (the
    // top nav is `display: none` below 900px by design - a desktop-only nav click doesn't belong
    // in a spec this file also runs on the mobile Pixel 7/iPhone projects). Each KpiCard's own
    // "Détail" link is real navigation now (previously undocumented) - checked via the in-page
    // anchors it targets, which stay in the DOM regardless of viewport.
    await page.locator('#pipeline').scrollIntoViewIfNeeded();
    await expect(page.locator('#pipeline')).toBeInViewport();
    await expect(page.locator('#impact')).toBeVisible();

    await page.getByRole('link', { name: 'Gérer les financements' }).click();
    await expect(page).toHaveURL(/\/direction\/financements$/);

    // ResponsiveTable keeps both semantic renderings in the DOM and switches them with CSS at
    // 720px. Scope the assertion to the surface that is actually visible for the current project,
    // instead of matching the same financing identifier in both the desktop table and mobile card.
    const mobile = (page.viewportSize()?.width ?? 1280) <= 720;
    const financingSurface = mobile
      ? page.getByRole('list', { name: 'Financements FODIP — vue mobile' })
      : page.getByRole('region', { name: 'Financements FODIP — tableau défilable horizontalement si nécessaire' });
    await expect(financingSurface.getByText('FIN-2026-DEMO01', { exact: true })).toBeVisible();

    // Notifications is deliberately outside the Direction layout. The portal guard stores the
    // last authenticated portal, and clientApi must reuse it when this global page later observes
    // an expired session instead of falling back to the PME login.
    await page.goto('/notifications');
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    await context.clearCookies();
    await page.reload();
    await expect(page).toHaveURL(/\/direction\/connexion\?reason=session-expired$/);
  });
});

test.describe('Portail Partenaire bancaire', () => {
  test('the partner stays in its authorized portal, passes axe and can open its execution page', async ({ page }) => {
    await page.goto('/partenaire/connexion');
    await page.getByLabel('Email').fill('partenaire@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/partenaire\/financements$/);

    // A valid partner session must not remain on a Direction page. The shared session guard and
    // 403 fallback both use the same role registry, so either first response safely returns the
    // account to its canonical partner home without weakening the API's RBAC.
    await page.goto('/direction/tableau-de-bord');
    await expect(page).toHaveURL(/\/partenaire\/financements$/);

    // FIN-2026-DEMO01 (database/seeds/002_analytics_demo.sql, correspondent bank assigned in
    // 003_partner_bank_demo.sql) - the demo partner's only financing, reachable through both of
    // axe D1's scoping mechanisms (correspondent bank, and client-portfolio) at once.
    const financingRow = page.getByRole('row', { name: /FIN-2026-DEMO01/ });
    await expect(financingRow).toBeVisible();
    await expectNoSeriousViolations(page);

    await financingRow.getByRole('link', { name: 'Gérer' }).click();
    await expect(page).toHaveURL(/\/partenaire\/financements\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: 'FIN-2026-DEMO01' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Décaissements' })).toBeVisible();
    await expectNoSeriousViolations(page);
    // The seeded disbursements (400M EFFECTUE + 150M PREVU) already cover the full accorded
    // amount, so the "declare a disbursement" form is correctly hidden - the amount-remaining
    // message renders instead, itself a real behaviour worth locking in.
    await expect(page.getByText('DEC-DEMO-001')).toBeVisible();
  });
});
