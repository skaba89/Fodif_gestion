import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Axe A6 (docs/14-ROADMAP-SAAS-PREMIUM.md): automated WCAG 2.1 A/AA scan, the durable proxy for
// what an actual screen-reader session would catch. This spec keeps checking serious and critical
// accessibility issues on every future change rather than relying on a one-time manual pass.
const DEMO_PASSWORD = 'FodipDemo2026!';

async function expectNoSeriousViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const relevant = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(relevant, JSON.stringify(relevant, null, 2)).toEqual([]);
}

test.describe('Accessibility (axe A6)', () => {
  test('the portal selector home page has no serious WCAG violations', async ({ page }) => {
    await page.goto('/');
    await expectNoSeriousViolations(page);
  });

  test('the PME login page has no serious WCAG violations', async ({ page }) => {
    await page.goto('/entrepreneur/connexion');
    await expectNoSeriousViolations(page);
  });

  test('the administration login page has no serious WCAG violations', async ({ page }) => {
    await page.goto('/administration/connexion');
    await expectNoSeriousViolations(page);
  });

  test('the design system reference page has no serious WCAG violations (axe A5)', async ({ page }) => {
    await page.goto('/design-system');
    await expectNoSeriousViolations(page);
  });

  // One session covers the authenticated shell, the cross-device hamburger drawer, light/dark
  // contrast, the dedicated profile and /mes-donnees with a single login. auditeur@fodip.local
  // avoids sharing the login rate-limit budget used by the PME workflow specs.
  test('the Auditeur portal, profile and institutional hamburger menu remain accessible', async ({ page }) => {
    await page.goto('/auditeur/connexion');
    await page.getByLabel('Email').fill('auditeur@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/auditeur\/tableau-de-bord$/);
    await expectNoSeriousViolations(page);

    const menuButton = page.getByRole('button', { name: 'Ouvrir le menu principal' });
    await expect(menuButton).toBeVisible();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await menuButton.click();

    const drawer = page.getByRole('dialog', { name: 'Navigation principale' });
    await expect(drawer).toBeVisible();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer.getByRole('link', { name: 'Supervision' })).toHaveAttribute('aria-current', 'page');
    await expectNoSeriousViolations(page);

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(menuButton).toBeFocused();

    await page.getByRole('button', { name: /Passer au thème/ }).click();
    // AppShell and account controls deliberately animate color/background over 150 ms. Axe must
    // sample the settled theme rather than an intermediate mixed palette whose transient contrast
    // is not representative of either final theme. Keep a small margin over --duration-fast.
    await page.waitForTimeout(200);
    await expectNoSeriousViolations(page);

    await menuButton.click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole('link', { name: 'Mon profil' }).click();
    await expect(page).toHaveURL(/\/profil$/);
    await expect(page.getByTestId('profile-email')).toHaveText('auditeur@fodip.local');
    await expect(page.getByTestId('profile-roles')).toContainText('Auditeur');
    await expectNoSeriousViolations(page);

    await page.getByRole('button', { name: 'Retour à l’espace' }).click();
    await expect(page).toHaveURL(/\/auditeur\/tableau-de-bord$/);
    await expectNoSeriousViolations(page);

    await menuButton.click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole('link', { name: 'Mes données' }).click();
    await expect(page).toHaveURL(/\/mes-donnees$/);
    await expectNoSeriousViolations(page);
  });
});
