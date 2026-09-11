import { expect, Page, test } from '@playwright/test';

// End-to-end coverage for the platform's core loop (axe C2b - docs/14-ROADMAP-SAAS-PREMIUM.md):
// a PME deposits a dossier, an agent instructs and scores it, and the committee decides - the
// three portals login.spec.ts/mfa.spec.ts exercise separately, but never as one continuous
// business transaction before this. Runs against the same live stack as the other e2e specs
// (see playwright.config.ts) - `docker compose up` first.
//
// Test data: pme@fodip.local's own enterprise (Kankan Agro Transformation SARL, seeded in
// database/seeds/001_docker_demo.sql) has no dossier of its own in the seed data, so the one
// created by this test is always the most recent (ORDER BY created_at DESC in
// applications.repository.ts#listByEnterprise) - `.first()` on that table is reliably ours even
// if this spec has run before against a stack that was never reset.
const DEMO_PASSWORD = 'FodipDemo2026!';

async function login(page: Page, email: string) {
  await page.goto('/connexion');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Déconnexion' }).click();
}

test.describe('Cycle complet d\'un dossier', () => {
  test('dépôt PME, instruction et scoring agent, décision du comité', async ({ page }) => {
    // --- PME: draft and submit a new funding application ---
    await login(page, 'pme@fodip.local');
    await expect(page).toHaveURL(/\/entrepreneur$/);

    await page.goto('/entrepreneur/demande');
    await expect(page.getByLabel('Étapes de la demande')).toContainText('1. Programme');
    await page.getByLabel('Programme').selectOption({ label: 'Programme Croissance PME' });
    // The programme is now the source of truth for its documentary requirements. The seed used by
    // the presentation stack configures three mandatory items for CROISSANCE-PME; asserting them
    // here locks the entire DB -> API -> BFF -> PME UI chain, not just a hard-coded frontend list.
    await expect(page.getByText('Pièces et justificatifs à préparer')).toBeVisible();
    await expect(page.getByText(/Registre du Commerce et du Crédit Mobilier/)).toBeVisible();
    await expect(page.getByText(/Numéro d’Identification Fiscale/)).toBeVisible();
    await expect(page.getByText(/Plan d’affaires/)).toBeVisible();

    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByLabel('Étapes de la demande')).toContainText('2. Financement');
    await page.getByLabel('Montant demandé (GNF)').fill('500000000');
    await page.getByLabel('Objet du financement').fill('Extension de la ligne de transformation');

    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByLabel('Étapes de la demande')).toContainText('3. Projet');
    await page.getByLabel('Description du projet').fill('Augmenter la capacité de transformation et soutenir la création d’emplois locaux.');
    await page.getByLabel('Emplois directs prévus').fill('12');

    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByLabel('Étapes de la demande')).toContainText('4. Vérification');
    await expect(page.getByText('Vérifiez votre brouillon avant enregistrement')).toBeVisible();
    await expect(page.getByText('500 000 000 GNF')).toBeVisible();
    await expect(page.getByText(/Extension de la ligne de transformation/)).toBeVisible();
    await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
    await expect(page).toHaveURL(/\/entrepreneur\/suivi$/);

    const ownRow = page.locator('table tbody tr').first();
    const numeroDossier = (await ownRow.locator('td').first().innerText()).trim();
    expect(numeroDossier).toMatch(/^FODIP-/);
    // This first lot makes completeness visible but intentionally does not block submission yet:
    // operational enforcement comes only after the FODIP validates which programme requirements
    // are truly mandatory. Until then the product must expose the gap without silently inventing a
    // business rule. The dossier therefore starts at 0/3 and remains submit-able.
    await expect(ownRow.getByText('0/3 · 0 %', { exact: true })).toBeVisible();
    await ownRow.getByRole('button', { name: 'Soumettre' }).click();
    await expect(ownRow.getByText('Soumis', { exact: true })).toBeVisible();

    await logout(page);
    await expect(page).toHaveURL(/\/connexion$/);

    // --- Agent: priority queue -> one-click claim/open -> focused instruction workspace ---
    await login(page, 'agent@fodip.local');
    await expect(page).toHaveURL(/\/agent\/dossiers$/);

    await page.getByLabel('Recherche').fill(numeroDossier);
    await page.getByRole('button', { name: 'Filtrer' }).click();
    await page.getByRole('button', { name: 'Prendre et instruire' }).first().click();
    await expect(page).toHaveURL(/\/agent\/dossiers\/[0-9a-f-]+$/);
    const dossierUrl = page.url();

    // Taking ownership and opening the workspace are one interaction. The detail therefore lands
    // already claimed and must not require the historical second "Prendre en charge" click.
    await expect(page.getByRole('button', { name: 'Prendre en charge' })).toHaveCount(0);

    // 4 criteria are seeded (database/seeds/001_docker_demo.sql, modèle SCORING-PME): fill every
    // one rather than hardcoding their labels, so this test does not drift if a criterion's
    // wording changes.
    const scoringForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Calculer et enregistrer' }) });
    const noteInputs = scoringForm.getByRole('spinbutton');
    await expect(noteInputs).toHaveCount(4);
    for (const input of await noteInputs.all()) await input.fill('80');
    await scoringForm.getByRole('button', { name: 'Calculer et enregistrer' }).click();
    await expect(page.getByText('Scoring calculé et enregistré.')).toBeVisible();
    await expect(page.getByText(/\/100 · /)).toBeVisible();

    await page.getByLabel('Décision d\'instruction').selectOption('PRET_COMITE');
    await page.getByLabel('Motivation de la décision').fill('Dossier complet, scoring favorable, transmis au comité.');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();

    // B2G trust requirement: the sensitive transition must be explicitly confirmed and the dialog
    // states that it will be timestamped in the audit history.
    const reviewDialog = page.getByRole('dialog', { name: 'Confirmer la décision d’instruction' });
    await expect(reviewDialog).toBeVisible();
    await expect(reviewDialog).toContainText('horodatée');
    await reviewDialog.getByRole('button', { name: 'Confirmer la décision' }).click();

    await expect(page.getByText('Décision d’instruction enregistrée.')).toBeVisible();
    // The technical enum remains visible next to the human-readable badge for traceability and
    // compatibility with downstream committee/audit workflows.
    await expect(page.getByText('PRET_COMITE', { exact: true })).toBeVisible();

    await logout(page);
    await expect(page).toHaveURL(/\/connexion$/);

    // --- Committee: review the score and decide, going straight to the dossier this test just
    // prepared (comite/dossiers itself is an undated, unfiltered queue - not worth paginating
    // through when the dossier's own id, shared with the agent-side route, is already known) ---
    await login(page, 'comite@fodip.local');
    await expect(page).toHaveURL(/\/comite\/dossiers$/);

    const committeeUrl = dossierUrl.replace('/agent/dossiers/', '/comite/dossiers/');
    await page.goto(committeeUrl);
    await expect(page.getByText('PRET_COMITE', { exact: true })).toBeVisible();
    // scores_dossier.score_total is NUMERIC(6,2) - always renders with two decimals. exact: true
    // because each criterion row below also renders "scoreObtenu/scoreMax" - with score_max
    // NUMERIC(10,2), that's "80.00/100.00", which contains "80.00/100" as a substring.
    await expect(page.getByText('80.00/100', { exact: true })).toBeVisible();

    await page.getByLabel('Décision').selectOption('APPROUVE');
    // Prefilled from the requested amount (montant_demande is NUMERIC(20,2), so the exact
    // string - "500000000.00" - isn't worth asserting on); just confirm the prefill happened.
    await expect(page.getByLabel('Montant approuvé (GNF)')).not.toHaveValue('');
    await page.getByLabel('Durée (mois)').fill('24');
    await page.getByRole('button', { name: 'Enregistrer la décision' }).click();
    await expect(page.getByText('Décision du comité enregistrée et auditée.')).toBeVisible();
    await expect(page.getByText('Ce dossier a déjà quitté la file décisionnelle.')).toBeVisible();

    await logout(page);

    // --- Closing the loop: the PME sees its dossier approved ---
    await login(page, 'pme@fodip.local');
    await expect(page).toHaveURL(/\/entrepreneur$/);
    await page.goto('/entrepreneur/suivi');
    const approvedRow = page.getByRole('row', { name: new RegExp(numeroDossier) });
    await expect(approvedRow.getByText('Approuvé', { exact: true })).toBeVisible();
  });
});
