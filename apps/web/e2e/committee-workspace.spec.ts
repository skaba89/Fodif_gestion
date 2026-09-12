import { expect, type Page, test } from '@playwright/test';

const EMAIL = 'comite@fodip.local';
const PASSWORD = 'FodipDemo2026!';

async function login(page: Page) {
  await page.goto('/connexion');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/comite\/tableau-de-bord$/);
}

async function expectNoOverflow(page: Page) {
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(1);
}

test.describe('Operational committee workspace', () => {
  test('prepares the agenda, searches decision history and exposes the auditable dossier', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { name: 'Tableau de bord Comité' })).toBeVisible();
    await expect(page.getByText('À statuer', { exact: true })).toBeVisible();

    await page.goto('/comite/dossiers?vue=ORDRE_DU_JOUR');
    await expect(page.getByRole('heading', { name: 'Ordre du jour du comité' })).toBeVisible();
    await page.getByLabel('Recherche').fill('FODIP-2026-DEMO05');
    await page.getByRole('button', { name: 'Filtrer' }).click();
    const agendaRow = page.getByRole('row', { name: /FODIP-2026-DEMO05/ });
    await expect(agendaRow).toBeVisible();
    await agendaRow.getByRole('link', { name: 'Examiner' }).click();

    await expect(page.getByRole('heading', { name: 'FODIP-2026-DEMO05' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Entreprise et projet' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pièces du dossier' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Chronologie d’instruction' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Imprimer la synthèse' })).toBeVisible();
    await expect(page.getByLabel('Je confirme avoir relu le dossier')).not.toBeChecked();

    await page.goto('/comite/dossiers?vue=HISTORIQUE');
    await expect(page.getByRole('heading', { name: 'Historique des décisions' })).toBeVisible();
    await page.getByLabel('Décision', { exact: true }).selectOption('APPROUVE');
    await page.getByRole('button', { name: 'Filtrer' }).click();
    await expect(page.getByRole('row', { name: /FODIP-2026-DEMO04/ })).toBeVisible();

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/comite/tableau-de-bord');
    await expect(page.getByRole('heading', { name: 'Tableau de bord Comité' })).toBeVisible();
    await expectNoOverflow(page);
    await page.goto('/comite/dossiers?vue=ORDRE_DU_JOUR');
    await expectNoOverflow(page);
  });
});
