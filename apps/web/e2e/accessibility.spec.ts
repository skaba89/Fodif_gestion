import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Axe A6 (docs/14-ROADMAP-SAAS-PREMIUM.md): automated WCAG 2.1 A/AA scan, the durable proxy for
// what an actual screen-reader session would catch - no assistive technology or human tester is
// available in this environment, but a violation axe-core reports (missing label, insufficient
// contrast, a landmark/heading problem...) is real and reproducible either way, and this spec
// keeps checking it on every future change rather than relying on a one-time manual pass.
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

  test('the PME portal (post-login) has no serious WCAG violations, light and dark', async ({ page }) => {
    await page.goto('/entrepreneur/connexion');
    await page.getByLabel('Email').fill('pme@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/entrepreneur$/);
    await expectNoSeriousViolations(page);

    await page.getByRole('button', { name: /Passer au thème/ }).click();
    await expectNoSeriousViolations(page);
  });

  test('the "Mes données" self-service page has no serious WCAG violations (axe B6)', async ({ page }) => {
    await page.goto('/entrepreneur/connexion');
    await page.getByLabel('Email').fill('pme@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/entrepreneur$/);

    await page.getByRole('link', { name: 'Mes données' }).click();
    await expect(page).toHaveURL(/\/mes-donnees$/);
    await expectNoSeriousViolations(page);
  });
});
