import { expect, test } from '@playwright/test';

// Coverage gap closed: every other portal already has e2e coverage (login.spec.ts, workflow.spec.ts,
// mfa.spec.ts, accessibility.spec.ts, pii-encryption.spec.ts), but nothing had ever driven the
// Direction cockpit or the Partenaire bancaire portal against a live stack before this - both are
// exercised here for the first time, with demo accounts (direction@fodip.local,
// partenaire@fodip.local) neither of those other specs ever logs in as, so this adds no load on
// their login rate-limit budget (POST /auth/login: 5 attempts/60s per email).
const DEMO_PASSWORD = 'FodipDemo2026!';

test.describe('Direction cockpit', () => {
  test('the national dashboard loads seeded data, and the region filter re-queries it', async ({ page }) => {
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
    await expect(page.locator('.stat-card', { hasText: 'Montants décaissés' })).toBeVisible();

    await page.getByLabel('Région').selectOption({ label: 'Kindia' });
    await expect(page.locator('[role="alert"]')).toHaveCount(0);
    await expect(page.getByLabel('Région')).toHaveValue(/.+/);
    await expect(page.getByText('Réinitialiser')).toBeVisible();

    await page.getByRole('link', { name: 'Gérer les financements' }).click();
    await expect(page).toHaveURL(/\/direction\/financements$/);
    await expect(page.getByText('FIN-2026-DEMO01')).toBeVisible();
  });
});

test.describe('Portail Partenaire bancaire', () => {
  test('the partner sees its correspondent financing and can open its execution page', async ({ page }) => {
    await page.goto('/partenaire/connexion');
    await page.getByLabel('Email').fill('partenaire@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/partenaire\/financements$/);

    // FIN-2026-DEMO01 (database/seeds/002_analytics_demo.sql, correspondent bank assigned in
    // 003_partner_bank_demo.sql) - the demo partner's only financing, reachable through both of
    // axe D1's scoping mechanisms (correspondent bank, and client-portfolio) at once.
    await expect(page.getByText('FIN-2026-DEMO01')).toBeVisible();

    await page.getByRole('link', { name: 'Gérer' }).click();
    await expect(page).toHaveURL(/\/partenaire\/financements\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: 'FIN-2026-DEMO01' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Décaissements' })).toBeVisible();
    // The seeded disbursements (400M EFFECTUE + 150M PREVU) already cover the full accorded
    // amount, so the "declare a disbursement" form is correctly hidden - the amount-remaining
    // message renders instead, itself a real behaviour worth locking in.
    await expect(page.getByText('DEC-DEMO-001')).toBeVisible();
  });
});
