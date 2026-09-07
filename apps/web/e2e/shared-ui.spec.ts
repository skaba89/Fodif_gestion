import { expect, test } from '@playwright/test';

test.describe('Shared institutional UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/design-system');
    await expect(page.getByTestId('shared-ui-showcase')).toBeVisible();
  });

  test('Button exposes disabled/loading states and Dialog restores focus on Escape', async ({ page }) => {
    const showcase = page.getByTestId('shared-ui-showcase');
    await expect(showcase.getByRole('button', { name: 'Désactivé', exact: true })).toBeDisabled();
    await expect(showcase.getByRole('button', { name: 'Chargement', exact: true })).toBeDisabled();

    const opener = showcase.getByRole('button', { name: 'Ouvrir Dialog' });
    await opener.click();
    const dialog = showcase.getByRole('dialog', { name: 'Dialog institutionnel' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Fermer' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('Toast is announced and can be dismissed manually', async ({ page }) => {
    const showcase = page.getByTestId('shared-ui-showcase');
    await showcase.getByRole('button', { name: 'Afficher un toast' }).click();
    await expect(page.getByText('Action enregistrée')).toBeVisible();
    await page.getByRole('button', { name: 'Fermer la notification' }).click();
    await expect(page.getByText('Action enregistrée')).toBeHidden();
  });

  test('FilterBar reports active filters and resets controlled fields', async ({ page }) => {
    const showcase = page.getByTestId('shared-ui-showcase');
    const search = showcase.getByLabel('Recherche');
    const status = showcase.getByLabel('Statut');

    await search.fill('FODIP');
    await status.selectOption('instruction');
    await expect(showcase.getByText('2 filtres actifs')).toBeVisible();

    await showcase.getByRole('button', { name: 'Réinitialiser' }).click();
    await expect(search).toHaveValue('');
    await expect(status).toHaveValue('');
    await expect(showcase.getByText('Aucun filtre actif')).toBeVisible();
  });

  test('ResponsiveTable keeps every labelled value in the mobile card view', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const showcase = page.getByTestId('shared-ui-showcase');
    const mobileList = showcase.getByRole('list', { name: 'Exemple de tableau institutionnel — vue mobile' });
    await expect(mobileList).toBeVisible();
    await expect(showcase.getByRole('table', { name: 'Exemple de tableau institutionnel' })).toBeHidden();

    const firstCard = mobileList.getByRole('listitem').first();
    await expect(firstCard).toContainText('Dossier');
    await expect(firstCard).toContainText('Exemple A');
    await expect(firstCard).toContainText('Programme');
    await expect(firstCard).toContainText('Programme de démonstration');
    await expect(firstCard).toContainText('Statut');
    await expect(firstCard).toContainText('En instruction');
    await expect(firstCard.getByRole('link', { name: 'Ouvrir' })).toBeVisible();
  });

  for (const width of [360, 390, 768, 1024, 1440]) {
    test(`design system has no page-level horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/design-system');
      await expect(page.getByTestId('shared-ui-showcase')).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    });
  }
});
