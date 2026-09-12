import { expect, test } from '@playwright/test';
import { LOGIN_HREF, PORTAL_ACCESS, resolveRoleHome, rolesCanAccessPortal } from '../lib/portal-access';

// Seeded by database/seeds/*.sql - see README.md "Comptes locaux de démonstration".
// None of these accounts have mfa_required=true; the MFA flow itself is covered in mfa.spec.ts.
const DEMO_PASSWORD = 'FodipDemo2026!';

const LEGACY_LOGIN_PATHS = [
  '/entrepreneur/connexion',
  '/agent/connexion',
  '/comite/connexion',
  '/direction/connexion',
  '/administration/connexion',
  '/auditeur/connexion',
  '/partenaire/connexion',
];

test.describe('Unified login flow', () => {
  test('the canonical role registry covers every RBAC role while every portal shares one login', () => {
    const expectedHomes: Array<[string, string]> = [
      ['SUPER_ADMIN', '/administration/utilisateurs'],
      ['DIRECTION_FODIP', '/direction/tableau-de-bord'],
      ['ANALYSTE', '/direction/tableau-de-bord'],
      ['AGENT_FODIP', '/agent/tableau-de-bord'],
      ['COMITE_FINANCEMENT', '/comite/dossiers'],
      ['AUDITEUR', '/auditeur/tableau-de-bord'],
      ['PARTENAIRE_BANCAIRE', '/partenaire/financements'],
      ['PME', '/entrepreneur'],
    ];

    for (const [role, home] of expectedHomes) expect(resolveRoleHome([role])).toBe(home);
    for (const portal of Object.values(PORTAL_ACCESS)) expect(portal.loginHref).toBe(LOGIN_HREF);
    expect(LOGIN_HREF).toBe('/connexion');

    expect(rolesCanAccessPortal(['SUPER_ADMIN'], 'direction')).toBe(true);
    expect(rolesCanAccessPortal(['SUPER_ADMIN'], 'partenaire')).toBe(false);
    expect(rolesCanAccessPortal(['PARTENAIRE_BANCAIRE'], 'direction')).toBe(false);
  });

  test('every historical login URL redirects to the single canonical login page', async ({ page }) => {
    for (const legacyPath of LEGACY_LOGIN_PATHS) {
      await page.goto(legacyPath);
      await expect(page).toHaveURL(/\/connexion$/);
      await expect(page.getByRole('heading', { name: 'Connexion FODIP', exact: true })).toBeVisible();
    }
  });

  test('a valid account is routed automatically from the single login to its authorized space and can switch account explicitly', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel('Email').fill('agent@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/agent\/tableau-de-bord$/);

    await page.goto('/connexion');
    const sessionCard = page.getByTestId('existing-session-card');
    await expect(sessionCard).toBeVisible();
    await expect(sessionCard).toContainText('Une session FODIP est déjà active');
    await sessionCard.getByRole('button', { name: 'Continuer vers mon espace' }).click();
    await expect(page).toHaveURL(/\/agent\/tableau-de-bord$/);

    await page.goto('/connexion');
    await expect(page.getByTestId('existing-session-card')).toBeVisible();
    await page.getByRole('button', { name: 'Changer d’utilisateur' }).click();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Mot de passe')).toBeVisible();
    await expect(page).toHaveURL(/\/connexion$/);
  });

  test('a SUPER_ADMIN account is routed to administration without selecting a role', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel('Email').fill('admin@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/administration\/utilisateurs$/);
  });

  test('a PME account uses the desktop role sidebar and the 375px PWA navigation without exposing identity details', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel('Email').fill('pme@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page).toHaveURL(/\/entrepreneur$/);
    await expect(page.getByText('pme@fodip.local')).toHaveCount(0);

    // Desktop: role navigation is persistent, reducing the extra menu click used by the old shell.
    const desktopNavigation = page.getByRole('navigation', { name: 'Navigation principale Espace PME' });
    await expect(desktopNavigation).toBeVisible();
    await expect(desktopNavigation.getByRole('link', { name: 'Accueil' })).toHaveAttribute('aria-current', 'page');
    await expect(desktopNavigation.getByRole('link', { name: 'Mon entreprise' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ouvrir le menu principal' })).toBeHidden();

    // Mobile/PWA: the same information architecture becomes a bottom navigation plus a complete
    // drawer, with a real 375px viewport rather than a CSS-only assumption.
    await page.setViewportSize({ width: 375, height: 812 });
    const mobileNavigation = page.getByRole('navigation', { name: 'Navigation mobile Espace PME' });
    await expect(mobileNavigation).toBeVisible();
    await expect(mobileNavigation.getByRole('link', { name: 'Accueil' })).toHaveAttribute('aria-current', 'page');

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

    await menuButton.click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole('link', { name: 'Mon entreprise' }).click();
    await expect(page).toHaveURL(/\/entrepreneur\/entreprise$/);
    await expect(drawer).toBeHidden();

    await menuButton.click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole('button', { name: 'Déconnexion' }).click();
    await expect(page).toHaveURL(/\/connexion$/);
    await expect(page.getByTestId('session-expired-notice')).toHaveCount(0);
  });

  test('an expired institutional session redirects to the shared login with an explicit inline message', async ({ page, context }) => {
    await page.goto('/connexion');
    await page.getByLabel('Email').fill('auditeur@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/auditeur\/tableau-de-bord$/);

    await context.clearCookies();
    await page.reload();

    await expect(page).toHaveURL(/\/connexion\?reason=session-expired$/);
    const expired = page.getByTestId('session-expired-notice');
    await expect(expired).toContainText('Session expirée');
    await expect(expired).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('wrong credentials show an inline field error and never set a session', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel('Email').fill('partenaire@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD + '-wrong');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page.getByLabel('Mot de passe')).toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL(/\/connexion$/);
  });
});
