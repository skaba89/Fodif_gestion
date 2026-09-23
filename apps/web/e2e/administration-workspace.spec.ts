import { expect, test } from '@playwright/test';

const PASSWORD = 'FodipDemo2026!';

test.describe('Espace Administration institutionnel', () => {
  test('pilote les comptes et expose la trace administrative', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel('Email').fill('admin@fodip.local');
    await page.getByLabel('Mot de passe').fill(PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/administration\/tableau-de-bord$/);
    await expect(page.getByRole('heading', { name: 'Tableau de bord Administration' })).toBeVisible();
    await expect(page.getByText('Comptes actifs', { exact: true })).toBeVisible();

    const email = `qualification-admin-workspace-${Date.now()}@fodip.local`;
    const created = await page.request.post('/api/administration/users', { data: {
      email, nom: 'Qualification', prenom: 'Administration', password: 'Qualification2026!', roles: ['ANALYSTE'],
    } });
    expect(created.ok(), await created.text()).toBeTruthy();
    const user = await created.json() as { id: string };

    try {
      await page.goto('/administration/utilisateurs');
      await page.getByLabel('Rechercher un compte').fill(email);
      const row = page.getByRole('row', { name: new RegExp(email) });
      await expect(row).toContainText('Jamais connecté');

      await page.goto('/administration/journal');
      await page.getByLabel('Action', { exact: true }).selectOption('CREATE_USER');
      await page.getByRole('button', { name: 'Filtrer' }).click();
      const auditSurface = (page.viewportSize()?.width ?? 1280) < 768
        ? page.getByRole('list', { name: 'Journal des actions d’administration — vue mobile' })
        : page.getByRole('table', { name: 'Journal des actions d’administration' });
      await expect(auditSurface).toContainText('Create user');
    } finally {
      await page.request.patch(`/api/administration/users/${user.id}`, { data: { actif: false } }).catch(() => undefined);
    }
  });
});
