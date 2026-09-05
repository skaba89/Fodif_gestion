import { expect, request as playwrightRequest, test } from '@playwright/test';

// Axe E5 (verrouillage optimiste, docs/14-ROADMAP-SAAS-PREMIUM.md) - real-browser coverage for the
// company profile form's own real, previously-unguarded lost-update risk: two PME staff (or one
// person in two tabs) at the same company, both with the form open, one saves after the other -
// the second save must be told, not silently overwritten. Uses two throwaway PME accounts attached
// to pme@fodip.local's own enterprise (database/seeds/001_docker_demo.sql) - the same "second user,
// same enterprise" pattern executive-demo.spec.ts already uses, so this adds no load on
// pme@fodip.local's own login-throttle budget. The test is nevertheless in HEAVY_LOGIN_SPECS
// (playwright.config.ts): it must authenticate the same seeded administrator once per project to
// create those users, so five sequential projects would exhaust admin@'s real 5-per-60s budget
// once retries are included. Chromium exercises the full concurrency scenario; the mobile and
// secondary-engine projects retain their dedicated navigation/accessibility coverage elsewhere.
const DEMO_PASSWORD = 'FodipDemo2026!';
const DEMO_ENTREPRISE_ID = '30000000-0000-4000-8000-000000000001';

test.describe('Fiche entreprise', () => {
  test('a second save after someone else already saved is refused, not silently overwritten', async ({ browser, baseURL }) => {
    const admin = await playwrightRequest.newContext({ baseURL });
    const adminLogin = await admin.post('/api/session/login', { data: { email: 'admin@fodip.local', password: DEMO_PASSWORD } });
    expect(adminLogin.ok()).toBeTruthy();

    const stamp = Date.now();
    const password = 'DemoE2E!Company2026';
    async function createPmeUser(tag: string) {
      const email = `demo.pme_${tag}.${stamp}@fodip.local`;
      const created = await admin.post('/api/administration/users', {
        data: { email, nom: `Démo PME ${tag}`, password, roles: ['PME'], entrepriseId: DEMO_ENTREPRISE_ID },
      });
      expect(created.ok()).toBeTruthy();
      const { id } = await created.json();
      return { id, email };
    }

    const userA = await createPmeUser('a');
    const userB = await createPmeUser('b');

    try {
      // Two independent browser sessions - not two tabs sharing one, but the same real scenario:
      // both load the form before either saves.
      const contextA = await browser.newContext();
      const contextB = await browser.newContext();
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();

      async function login(page: typeof pageA, email: string) {
        await page.goto('/entrepreneur/connexion');
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Mot de passe').fill(password);
        await page.getByRole('button', { name: 'Se connecter' }).click();
        await expect(page).toHaveURL(/\/entrepreneur$/);
        await page.goto('/entrepreneur/entreprise');
      }

      await login(pageA, userA.email);
      await login(pageB, userB.email);
      await expect(pageA.getByLabel("Nombre d'employés")).toBeVisible();
      await expect(pageB.getByLabel("Nombre d'employés")).toBeVisible();

      // B saves first.
      await pageB.getByLabel("Nombre d'employés").fill('42');
      await pageB.getByRole('button', { name: 'Enregistrer les modifications' }).click();
      await expect(pageB.getByText('Modifications enregistrées.')).toBeVisible();

      // A, still holding the version from before B's save, tries to save too - refused, with a
      // clear explanation, not silently replacing what B just wrote.
      await pageA.getByLabel("Nombre d'employés").fill('7');
      await pageA.getByRole('button', { name: 'Enregistrer les modifications' }).click();
      await expect(pageA.getByText(/mis(e)? à jour par quelqu.?un d.?autre|updated by someone else/i)).toBeVisible();

      // B's write stands - never silently overwritten by A's conflicting one.
      await pageB.reload();
      await expect(pageB.getByLabel("Nombre d'employés")).toHaveValue('42');

      // A tries again with the now-current version (the page refetched it after the conflict) -
      // this time it goes through, proving the block was about the stale version, not a hard lock.
      await pageA.getByLabel("Nombre d'employés").fill('7');
      await pageA.getByRole('button', { name: 'Enregistrer les modifications' }).click();
      await expect(pageA.getByText('Modifications enregistrées.')).toBeVisible();

      await contextA.close();
      await contextB.close();
    } finally {
      await Promise.all([userA.id, userB.id].map((id) => admin.patch(`/api/administration/users/${id}`, { data: { actif: false } }).catch(() => undefined)));
      await admin.dispose();
    }
  });
});
