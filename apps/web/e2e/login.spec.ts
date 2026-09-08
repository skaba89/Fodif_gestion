import { expect, test } from '@playwright/test';
import { PORTAL_ACCESS, resolveRoleHome, rolesCanAccessPortal } from '../lib/portal-access';

// Seeded by database/seeds/001_docker_demo.sql - see README.md "Comptes locaux de démonstration".
// None of these accounts have mfa_required=true; the MFA flow itself is covered in mfa.spec.ts.
const DEMO_PASSWORD = 'FodipDemo2026!';

test.describe('Login flow', () => {
  test('the canonical portal registry covers every RBAC role and portal', () => {
    const expectedHomes: Array<[string, string]> = [
      ['SUPER_ADMIN', '/administration/utilisateurs'],
      ['DIRECTION_FODIP', '/direction/tableau-de-bord'],
      ['ANALYSTE', '/direction/tableau-de-bord'],
      ['AGENT_FODIP', '/agent/dossiers'],
      ['COMITE_FINANCEMENT', '/comite/dossiers'],
      ['AUDITEUR', '/auditeur/tableau-de-bord'],
      ['PARTENAIRE_BANCAIRE', '/partenaire/financements'],
      ['PME', '/entrepreneur'],
    ];

    for (const [role, home] of expectedHomes) expect(resolveRoleHome([role])).toBe(home);

    expect(PORTAL_ACCESS.entrepreneur.loginHref).toBe('/entrepreneur/connexion');
    expect(PORTAL_ACCESS.agent.loginHref).toBe('/agent/connexion');
    expect(PORTAL_ACCESS.comite.loginHref).toBe('/comite/connexion');
    expect(PORTAL_ACCESS.direction.loginHref).toBe('/direction/connexion');
    expect(PORTAL_ACCESS.administration.loginHref).toBe('/administration/connexion');
    expect(PORTAL_ACCESS.auditeur.loginHref).toBe('/auditeur/connexion');
    expect(PORTAL_ACCESS.partenaire.loginHref).toBe('/partenaire/connexion');

    expect(rolesCanAccessPortal(['SUPER_ADMIN'], 'direction')).toBe(true);
    expect(rolesCanAccessPortal(['SUPER_ADMIN'], 'partenaire')).toBe(false);
    expect(rolesCanAccessPortal(['PARTENAIRE_BANCAIRE'], 'direction')).toBe(false);
  });

  test('a valid account using the wrong portal is routed to its own space and can switch account explicitly', async ({ page }) => {
    await page.goto('/administration/connexion');
    await page.getByLabel('Email').fill('agent@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    // Authentication succeeds for the real account, but the UI never grants the Administration
    // portal: the canonical registry sends this AGENT_FODIP session to its own authorized home.
    await expect(page).toHaveURL(/\/agent\/dossiers$/);

    // Opening another portal login while already authenticated must not silently replace the
    // account. The user can continue the current session or explicitly log it out first.
    await page.goto('/direction/connexion');
    const sessionCard = page.getByTestId('existing-session-card');
    await expect(sessionCard).toBeVisible();
    await expect(sessionCard).toContainText('Une session FODIP est déjà active');
    await sessionCard.getByRole('button', { name: 'Continuer vers mon espace' }).click();
    await expect(page).toHaveURL(/\/agent\/dossiers$/);

    await page.goto('/direction/connexion');
    await expect(page.getByTestId('existing-session-card')).toBeVisible();
    await page.getByRole('button', { name: 'Changer d’utilisateur' }).click();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Mot de passe')).toBeVisible();
    await expect(page).toHaveURL(/\/direction\/connexion$/);
  });

  test('an institutional account entering through PME login is routed to its canonical portal', async ({ page }) => {
    await page.goto('/entrepreneur/connexion');
    await page.getByLabel('Email').fill('admin@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page).toHaveURL(/\/administration\/utilisateurs$/);
  });

  test('a PME account keeps identity details in profile only, navigates through the hamburger menu and can log out', async ({ page }) => {
    await page.goto('/entrepreneur/connexion');
    await page.getByLabel('Email').fill('pme@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page).toHaveURL(/\/entrepreneur$/);
    await expect(page.getByText('pme@fodip.local')).toHaveCount(0);

    const menuButton = page.getByRole('button', { name: 'Ouvrir le menu principal' });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const drawer = page.getByRole('dialog', { name: 'Navigation principale' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('pme@fodip.local')).toHaveCount(0);
    await expect(drawer.getByText('PME', { exact: true })).toHaveCount(0);
    await expect(drawer.getByRole('link', { name: 'Mon espace' })).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'Mon profil' })).toBeVisible();

    await drawer.getByRole('link', { name: 'Mon profil' }).click();
    await expect(page).toHaveURL(/\/profil$/);
    await expect(page.getByTestId('profile-email')).toHaveText('pme@fodip.local');
    await expect(page.getByTestId('profile-roles')).toContainText('PME');

    await page.getByRole('button', { name: 'Retour à mon espace' }).click();
    await expect(page).toHaveURL(/\/entrepreneur$/);
    await expect(page.getByText('pme@fodip.local')).toHaveCount(0);

    await menuButton.click();
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'Mon entreprise' })).toBeVisible();
    await drawer.getByRole('link', { name: 'Mon entreprise' }).click();
    await expect(page).toHaveURL(/\/entrepreneur\/entreprise$/);
    await expect(drawer).toBeHidden();

    await page.getByRole('button', { name: 'Déconnexion' }).click();
    await expect(page).toHaveURL(/\/entrepreneur\/connexion$/);

    // Intentional logout remains distinct from expiry: it must not display the expiry warning.
    await expect(page.getByTestId('session-expired-notice')).toHaveCount(0);
  });

  test('an expired session redirects to the login page of the same role with an explicit message', async ({ page, context }) => {
    await page.goto('/auditeur/connexion');
    await page.getByLabel('Email').fill('auditeur@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/auditeur\/tableau-de-bord$/);

    // Clearing the HttpOnly session cookie simulates an expired access token without waiting 15 minutes.
    await context.clearCookies();
    await page.reload();

    await expect(page).toHaveURL(/\/auditeur\/connexion\?reason=session-expired$/);
    await expect(page.getByTestId('session-expired-notice')).toContainText('Votre session a expiré');
  });

  test('wrong credentials show an error and never set a session', async ({ page }) => {
    await page.goto('/partenaire/connexion');
    await page.getByLabel('Email').fill('partenaire@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD + '-wrong');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page).toHaveURL(/\/partenaire\/connexion$/);
  });
});
