import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Support assistant', () => {
  test('the assistance page is accessible without consuming an authentication attempt', async ({ page }) => {
    await page.goto('/assistance');

    await expect(page.getByRole('heading', { name: "Assistant d'orientation et de support" })).toBeVisible();
    await expect(page.getByLabel('Votre question')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Envoyer' })).toBeDisabled();
    await expect(page.getByText('Cadre de sécurité.')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const relevant = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );

    expect(relevant, JSON.stringify(relevant, null, 2)).toEqual([]);
  });
});
