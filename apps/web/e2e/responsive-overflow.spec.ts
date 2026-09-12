import { expect, type Page, test } from '@playwright/test';

const AGENT_EMAIL = 'qualification-agent@fodip.local';
const DEMO_PASSWORD = 'FodipDemo2026!';
const AGENT_HOME = '/agent/tableau-de-bord';
const AGENT_QUEUE = '/agent/dossiers?vue=A_PRENDRE';
const AGENT_DETAIL = '/agent/dossiers/60000000-0000-4000-8000-000000000002';

async function loginAgent(page: Page) {
  await page.goto('/connexion');
  await page.getByLabel('Email').fill(AGENT_EMAIL);
  await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(new RegExp(`${AGENT_HOME}$`));
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
  test('Agent workspace stays within every supported viewport', async ({ page }) => {
    const viewports = [
    { width: 1366, height: 900 },
    { width: 1024, height: 800 },
    { width: 768, height: 900 },
    { width: 430, height: 900 },
    { width: 375, height: 812 },
    ];

    await page.setViewportSize(viewports[0]);
    await loginAgent(page);

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto(AGENT_HOME);

      await expect(page.getByRole('heading', { name: 'Tableau de bord Agent' })).toBeVisible();
      await expectNoPageOverflow(page);

      if (viewport.width > 960) {
        await expectNoSidebarOverflow(page);
      } else {
        await expect(page.getByRole('complementary', { name: 'Navigation Espace Agent' })).toBeHidden();
        await expect(page.getByRole('navigation', { name: 'Navigation mobile Espace Agent' })).toBeVisible();
      }

      await page.goto(AGENT_QUEUE);
      await expect(page.getByRole('heading', { name: 'Dossiers à prendre en charge' })).toBeVisible();
      await expectNoPageOverflow(page);

      await page.goto(AGENT_DETAIL);
      await expect(page.getByRole('heading', { name: 'FODIP-2026-DEMO02' })).toBeVisible();
      await expectNoPageOverflow(page);
    }

    await page.setViewportSize(viewports[0]);
    await page.goto(AGENT_HOME);

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
