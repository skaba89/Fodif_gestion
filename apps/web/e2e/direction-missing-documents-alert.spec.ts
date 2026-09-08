import { expect, test } from '@playwright/test';

const DEMO_PASSWORD = 'FodipDemo2026!';

test.describe('Cockpit Direction - complétude documentaire', () => {
  test('affiche une alerte réelle quand des dossiers engagés ont des pièces obligatoires manquantes', async ({ page }, testInfo) => {
    // One desktop project is enough for this data-backed contract. The complete responsive/browser
    // matrix is already exercised by the shared cockpit suites; repeating the same seeded login on
    // every project would only consume /auth/login's per-email throttle budget.
    test.skip(testInfo.project.name !== 'chromium', 'Preuve fonctionnelle ciblée sur Chromium desktop.');

    const login = await page.request.post('/api/session/login', {
      data: { email: 'direction@fodip.local', password: DEMO_PASSWORD },
    });
    expect(login.ok(), 'Direction demo session login').toBeTruthy();

    await page.goto('/direction/tableau-de-bord');
    await expect(page.getByRole('heading', { name: 'Vue d’ensemble du portefeuille FODIP' })).toBeVisible();
    await expect(page.getByText('Dossiers avec pièces obligatoires manquantes', { exact: true })).toBeVisible();
    await expect(page.getByText(/pièce\(s\) obligatoire\(s\) encore manquante\(s\)/)).toBeVisible();
  });
});
