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

  test('the design system reference page has no serious WCAG violations (axe A5)', async ({ page }) => {
    await page.goto('/design-system');
    await expectNoSeriousViolations(page);
  });

  // One session covers three checks (portal home in light and dark, then /mes-donnees - axe B6)
  // with a single login, and deliberately as auditeur@fodip.local rather than the PME account:
  // /auth/login is rate-limited to 5 attempts per email per 60s
  // (apps/api/src/auth/auth.controller.ts), and pme@fodip.local's budget in this same run is
  // already spent close to that limit by login.spec.ts and workflow.spec.ts's own two logins as
  // that account - a login here as a role neither of those specs ever uses avoids the shared
  // budget entirely rather than trying to stay just under it.
  test('the Auditeur portal has no serious WCAG violations: home (light/dark) and /mes-donnees (axe B6)', async ({ page }) => {
    await page.goto('/auditeur/connexion');
    await page.getByLabel('Email').fill('auditeur@fodip.local');
    await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/auditeur\/tableau-de-bord$/);
    await expectNoSeriousViolations(page);

    await page.getByRole('button', { name: /Passer au thème/ }).click();
    await expectNoSeriousViolations(page);

    await page.getByRole('link', { name: 'Mes données' }).click();
    await expect(page).toHaveURL(/\/mes-donnees$/);
    await expectNoSeriousViolations(page);
  });
});
