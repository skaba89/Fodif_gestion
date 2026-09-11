import { expect, test } from '@playwright/test';

const DEMO_PASSWORD = 'FodipDemo2026!';

async function login(page: import('@playwright/test').Page, email: string, expectedPath: RegExp) {
  await page.goto('/connexion');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(expectedPath);
}

test.describe('Programmes FODIP — catalogue et administration institutionnelle', () => {
  test('Direction sees the management lifecycle while existing active programmes stay available', async ({ page }) => {
    await login(page, 'direction@fodip.local', /\/direction\/tableau-de-bord$/);
    await page.goto('/direction/programmes');

    await expect(page.getByRole('heading', { name: 'Programmes FODIP' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Créer un programme' })).toBeVisible();
    await expect(page.getByLabel('Code')).toBeVisible();
    await expect(page.getByText('CROISSANCE-PME')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ouvrir le programme' }).first()).toBeVisible();
  });

  test('Agent can consult the catalogue and prepare a governed proposal but cannot call management endpoints', async ({ page }) => {
    await login(page, 'agent@fodip.local', /\/agent\/dossiers$/);
    await page.goto('/agent/programmes');

    await expect(page.getByRole('heading', { name: 'Programmes FODIP actifs' })).toBeVisible();
    await expect(page.getByTestId('program-card').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Créer un programme' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Proposer un nouveau programme' })).toBeVisible();
    await expect(page.getByTestId('program-proposal-panel')).toBeVisible();
    await expect(page.getByText('Conakry', { exact: true })).toBeVisible();
    await expect(page.getByText('Agriculture', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enregistrer le brouillon' })).toBeVisible();

    const status = await page.evaluate(async () => {
      const response = await fetch('/api/direction/programmes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'FORBIDDEN-QA', nom: 'Ne doit jamais être créé' }),
      });
      return response.status;
    });
    expect(status).toBe(403);
  });

  test('PME catalogue exposes programme conditions before starting a request', async ({ page }) => {
    await login(page, 'pme@fodip.local', /\/entrepreneur$/);
    await page.goto('/entrepreneur/programmes');

    await expect(page.getByRole('heading', { name: 'Programmes FODIP ouverts' })).toBeVisible();
    await expect(page.getByTestId('program-card').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Créer une demande' })).toBeVisible();
  });
});
