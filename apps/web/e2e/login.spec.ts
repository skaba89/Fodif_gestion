import { expect, test } from '@playwright/test';

// Seeded by database/seeds/001_docker_demo.sql - see README.md "Comptes locaux de démonstration".
// None of these accounts have mfa_required=true; the MFA flow itself is covered in mfa.spec.ts.
const DEMO_PASSWORD = 'FodipDemo2026!';

test.describe('Login flow', () => {
  test('a portal rejects an authenticated account without the right role', async ({ page }) => {
    await page.goto('/administration/connexion');
    await page.getByLabel('Email').fill('agent@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByRole('alert')).toContainText('super-administrateur');
    await expect(page).toHaveURL(/\/administration\/connexion$/);
  });

  test('a PME account reaches its own space and can log out', async ({ page }) => {
    await page.goto('/entrepreneur/connexion');
    await page.getByLabel('Email').fill('pme@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page).toHaveURL(/\/entrepreneur$/);
    await expect(page.getByRole('link', { name: 'Mon entreprise' })).toBeVisible();
    await expect(page.getByText('pme@fodip.local')).toBeVisible();

    await page.getByRole('button', { name: 'Déconnexion' }).click();
    await expect(page).toHaveURL(/\/entrepreneur\/connexion$/);

    // The session cookie is gone: a direct visit to a protected page bounces back to it
    // (or renders it logged out) rather than showing PME data.
    await page.goto('/entrepreneur');
    await expect(page.getByRole('link', { name: 'Connexion' })).toBeVisible();
  });

  test('wrong credentials show an error and never set a session', async ({ page }) => {
    await page.goto('/agent/connexion');
    await page.getByLabel('Email').fill('agent@fodip.local');
    await page.getByLabel('Mot de passe').fill('not-the-right-password');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/agent\/connexion$/);
  });
});
