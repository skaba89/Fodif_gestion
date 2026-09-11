import { expect, type Page, test } from '@playwright/test';

const AGENT_EMAIL = 'qualification-agent@fodip.local';
const DEMO_PASSWORD = 'FodipDemo2026!';
const AGENT_HOME = '/agent/dossiers';
const AGENT_DETAIL = '/agent/dossiers/60000000-0000-4000-8000-000000000002';

async function loginAgent(page: Page) {
  await page.goto('/connexion');
  await page.getByLabel('Email').fill(AGENT_EMAIL);
  await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/agent\/dossiers$/);
}

async function expectNoPageOverflow(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  }), { timeout: 10_000 }).toBeLessThanOrEqual(1);
}

async function expectNoSidebarOverflow(page: Page) {
  const sidebar = page.getByRole('complementary', { name: 'Navigation Espace Agent' });
  await expect(sidebar).toBeVisible();
  await expect.poll(async () => sidebar.evaluate((element) => element.scrollWidth - element.clientWidth))
    .toBeLessThanOrEqual(1);
}

test.describe('Authenticated portal responsive bounds', () => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1024, height: 800 },
    { width: 960, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`Agent workspace has no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await loginAgent(page);

      await expect(page.getByRole('heading', { name: 'Dossiers à traiter' })).toBeVisible();
      await expectNoPageOverflow(page);

      if (viewport.width > 960) {
        await expectNoSidebarOverflow(page);
      } else {
        await expect(page.getByRole('complementary', { name: 'Navigation Espace Agent' })).toBeHidden();
        await expect(page.getByRole('navigation', { name: 'Navigation mobile Espace Agent' })).toBeVisible();
      }

      await page.goto(AGENT_DETAIL);
      await expect(page.getByRole('heading', { name: 'Instruction du dossier' })).toBeVisible();
      await expectNoPageOverflow(page);
    });
  }

  test('account actions stay inside the desktop sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAgent(page);

    const sidebar = page.getByRole('complementary', { name: 'Navigation Espace Agent' });
    const accountActions = sidebar.getByLabel('Actions du compte');
    await expect(accountActions).toBeVisible();
    await expect(accountActions.getByRole('link', { name: 'Mon espace' })).toBeVisible();
    await expect(accountActions.getByRole('link', { name: 'Assistance' })).toBeVisible();
    await expect(accountActions.getByRole('link', { name: 'Mon profil' })).toBeVisible();
    await expect(accountActions.getByRole('button', { name: 'Déconnexion' })).toBeVisible();

    const overflow = await accountActions.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expectNoSidebarOverflow(page);
  });
});
