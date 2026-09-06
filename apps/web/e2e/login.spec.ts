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

    await expect(page.getByTestId('login-error')).toContainText('super-administrateur');
    await expect(page).toHaveURL(/\/administration\/connexion$/);
  });

  test('an institutional account entering through PME login is routed to its canonical portal', async ({ page }) => {
    await page.goto('/entrepreneur/connexion');
    await page.getByLabel('Email').fill('admin@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page).toHaveURL(/\/administration\/utilisateurs$/);
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

    // Intentional logout remains distinct from expiry: it must not display the expiry warning.
    await expect(page.getByTestId('session-expired-notice')).toHaveCount(0);
  });

  test('an expired session redirects to login with an explicit message', async ({ page, context }) => {
    await page.goto('/entrepreneur/connexion');
    await page.getByLabel('Email').fill('pme@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/entrepreneur$/);

    // Clearing the HttpOnly session cookie simulates an expired access token without waiting 15 minutes.
    await context.clearCookies();
    await page.reload();

    await expect(page).toHaveURL(/\/entrepreneur\/connexion\?reason=session-expired$/);
    await expect(page.getByTestId('session-expired-notice')).toContainText('Votre session a expiré');
  });

  test('wrong credentials show an error and never set a session', async ({ page }) => {
    await page.goto('/agent/connexion');
    await page.getByLabel('Email').fill('agent@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD + '-wrong');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page).toHaveURL(/\/agent\/connexion$/);
  });
});
