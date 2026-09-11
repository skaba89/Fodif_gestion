import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Automated WCAG A/AA guardrail. WCAG 2.0/2.1 tags keep the established baseline while the
// wcag22aa tag adds the WCAG 2.2 AA rules supported by the installed axe-core version.
const DEMO_PASSWORD = 'FodipDemo2026!';

async function expectNoSeriousViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const relevant = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(relevant, JSON.stringify(relevant, null, 2)).toEqual([]);
}

test.describe('Accessibility (WCAG 2.2 AA guardrails)', () => {
  test('the portal selector home page has no serious WCAG violations', async ({ page }) => {
    await page.goto('/');
    await expectNoSeriousViolations(page);
  });

  test('the unified login page has no serious WCAG violations at 1440px and 375px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/connexion');
    await expect(page.getByRole('heading', { name: 'Connexion FODIP' })).toBeVisible();
    await expectNoSeriousViolations(page);

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('heading', { name: 'Connexion FODIP' })).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test('the design system reference page has no serious WCAG violations', async ({ page }) => {
    await page.goto('/design-system');
    await expectNoSeriousViolations(page);
  });

  // One authenticated session verifies both required shell breakpoints without spending another
  // login from the real 5-per-60s throttle. Desktop gets the persistent role sidebar; at 375px it
  // becomes a bottom navigation plus accessible drawer.
  test('the Auditeur shell, profile and navigation remain accessible at desktop and 375px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/connexion');
    await page.getByLabel('Email').fill('auditeur@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/auditeur\/tableau-de-bord$/);

    const desktopNavigation = page.getByRole('navigation', { name: 'Navigation Auditeur' });
    await expect(desktopNavigation).toBeVisible();
    await expect(desktopNavigation.getByRole('link', { name: 'Supervision' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: 'Ouvrir le menu principal' })).toBeHidden();
    await expectNoSeriousViolations(page);

    await page.setViewportSize({ width: 375, height: 812 });
    const mobileNavigation = page.getByRole('navigation', { name: 'Navigation mobile Auditeur' });
    await expect(mobileNavigation).toBeVisible();
    await expect(mobileNavigation.getByRole('link', { name: 'Supervision' })).toHaveAttribute('aria-current', 'page');

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
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expectNoSeriousViolations(page);

    await menuButton.click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole('link', { name: 'Mon profil' }).click();
    await expect(page).toHaveURL(/\/profil$/);
    await expect(page.getByTestId('profile-email')).toHaveText('auditeur@fodip.local');
    await expect(page.getByTestId('profile-roles')).toContainText('Auditeur');
    await expectNoSeriousViolations(page);

    await page.getByRole('button', { name: 'Retour à mon espace' }).click();
    await expect(page).toHaveURL(/\/auditeur\/tableau-de-bord$/);
    await expectNoSeriousViolations(page);

    await menuButton.click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole('link', { name: 'Mes données' }).click();
    await expect(page).toHaveURL(/\/mes-donnees$/);
    await expectNoSeriousViolations(page);
  });
});
