import { expect, Page, request as playwrightRequest, test } from '@playwright/test';
import * as OTPAuth from 'otpauth';

// Mission "présentation Directeur général" (section 10): drives the demo scenario the mission's
// own section 8 names step by step - "Accueil institutionnel -> Connexion Direction -> MFA ->
// Cockpit national -> Filtre région -> Dossier PME -> Décision comité -> Financement ->
// Décaissements -> Remboursements -> Suivi d'impact" (11 named steps; the mission's section 10
// separately says "13 étapes" without listing two more anywhere - only the 11 the mission's own
// text actually names are implemented here, not padded to hit that number).
//
// Rather than replaying seeded, already-decided data, this test drives one dossier through the
// ENTIRE real lifecycle live - deposit, instruction, committee decision, financing creation,
// disbursement, repayment, impact snapshot - the same proof-of-real-buttons standard as
// workflow.spec.ts, extended past where that spec stops into direction/financements' own "create
// from an approved decision" flow. Every button the mission's demo narrative needs to show
// working is actually clicked here.
//
// Login budget: unlike workflow.spec.ts, this does NOT log in as the shared pme@/agent@/
// comite@fodip.local accounts - a first version did, and running the full HEAVY_LOGIN_SPECS group
// together tripped /auth/login's 5-attempts/60s-per-email throttle for real (agent@ specifically),
// breaking pii-encryption.spec.ts and workflow.spec.ts in the same run - found the hard way, not
// guessed. Every role this scenario needs (PME, agent, comité, direction) is instead a freshly
// created, single-use account, all disabled at the end - the same pattern
// accessibility.spec.ts/direction-partenaire.spec.ts/mfa.spec.ts/pii-encryption.spec.ts already
// use to stay out of the shared budget entirely, applied to all four roles here since this single
// test spans all of them. Still listed in HEAVY_LOGIN_SPECS (firefox/webkit/mobile projects don't
// run it) because five real POSTs to /auth/login in one test is still real load, just not on
// emails anything else in this run touches.
//
// Also found the hard way: AGENT_FODIP and COMITE_FINANCEMENT are PRIVILEGED_ROLES too
// (apps/api/src/admin-policy.js), not just DIRECTION_FODIP - a fresh account in either role is
// auto-MFA-enrolled exactly like the Direction one, and the login() helper below has to complete
// that same one-time enrollment challenge for all three, not just Direction.
const DEMO_PASSWORD = 'FodipDemo2026!';
const SETUP_ADMIN_EMAIL = 'qualification-admin@fodip.local';
// pme@fodip.local's own enterprise (database/seeds/001_docker_demo.sql) - a second user attached
// to the same enterprise is a realistic multi-user PME account, not a workaround.
const DEMO_ENTREPRISE_ID = '30000000-0000-4000-8000-000000000001';

function codeFor(secret: string, timestamp?: number): string {
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30, algorithm: 'SHA1' });
  return totp.generate({ timestamp });
}

/** Logs in; if the account requires MFA and this is its first login, completes enrollment and
 * returns the confirmed secret (undefined for a PME account, which is never MFA-required). */
async function login(page: Page, path: string, email: string, password: string): Promise<string | undefined> {
  await page.goto(path);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  // No auto-wait built into a plain visibility check right after a click - the enrollment UI (or
  // the redirect past it, for a non-privileged account like PME) needs a moment to render.
  const enrolled = await page.getByText('double authentification').waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
  if (!enrolled) return undefined;
  const secret = (await page.locator('code').innerText()).trim();
  await page.getByLabel('Code à 6 chiffres').fill(codeFor(secret));
  await page.getByRole('button', { name: 'Activer et se connecter' }).click();
  return secret;
}

/** Waits out whatever remains of the current 30s TOTP step, so the next generated code both
 * matches the server's real clock (no forward-skew tolerance to rely on) and is guaranteed to be
 * on a step nothing has used yet - the only fix that holds for any number of loginWithMfa calls on
 * the same account, unlike guessing a fixed number of steps ahead (a code more than one step in
 * the future is simply invalid, not merely "already used" - found the hard way, projecting further
 * into the future to dodge a replay broke verification outright instead). */
async function waitForFreshTotpStep(page: Page) {
  const period = 30_000;
  await page.waitForTimeout(period - (Date.now() % period) + 250);
}

/** Logs back in as an already-enrolled account (verification challenge, not enrollment). */
async function loginWithMfa(page: Page, path: string, email: string, password: string, secret: string) {
  await page.goto(path);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByText('Saisissez le code à 6 chiffres')).toBeVisible();
  // The enrollment code (codeFor(secret), i.e. the step at enrollment time) already consumed its
  // step - wait for a genuinely new one rather than assuming a fixed number of steps have or
  // haven't already elapsed since enrollment or since this account's last verification.
  await waitForFreshTotpStep(page);
  await page.getByLabel('Code à 6 chiffres').fill(codeFor(secret));
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Déconnexion' }).click();
}

test.describe('Scénario de démonstration Direction générale', () => {
  test('accueil, connexion Direction + MFA, cockpit filtré, cycle complet PME -> financement -> impact', async ({ page, baseURL }) => {
    // This one scenario intentionally exercises 11 business steps, five temporary accounts,
    // privileged-role MFA enrollment and two later MFA verifications. Those verifications can each
    // wait for a fresh 30-second TOTP window by design. Give the complete lifecycle a bounded
    // five-minute budget while keeping all individual locator/assertion timeouts unchanged.
    test.setTimeout(300_000);
    const admin = await playwrightRequest.newContext({ baseURL });
    const adminLogin = await admin.post('/api/session/login', { data: { email: SETUP_ADMIN_EMAIL, password: DEMO_PASSWORD } });
    expect(adminLogin.ok(), 'admin login for test setup').toBeTruthy();

    const stamp = Date.now();
    const password = 'DemoE2E!Scenario2026';
    // emailTag defaults to the role code, but two demo accounts sharing the same role (direction
    // and direction2 below, for maker-checker) need distinct emails despite the same stamp.
    async function createDemoUser(roleCode: string, nom: string, extra: Record<string, unknown> = {}, emailTag = roleCode.toLowerCase()) {
      const email = `demo.${emailTag}.${stamp}@fodip.local`;
      const created = await admin.post('/api/administration/users', {
        data: { email, nom, password, roles: [roleCode], ...extra },
      });
      expect(created.ok(), `creating the temporary ${roleCode} demo account`).toBeTruthy();
      const { id } = await created.json();
      return { id, email };
    }

    const direction = await createDemoUser('DIRECTION_FODIP', 'Démo Direction');
    // Axe E5 (maker-checker, docs/14-ROADMAP-SAAS-PREMIUM.md) - a second Direction officer, used
    // below to confirm the disbursement `direction` plans: financings.repository.ts
    // #executeDisbursement now refuses to let the same user do both.
    const direction2 = await createDemoUser('DIRECTION_FODIP', 'Démo Direction (contrôle)', {}, 'direction_fodip_checker');
    const pme = await createDemoUser('PME', 'Démo PME', { entrepriseId: DEMO_ENTREPRISE_ID });
    const agent = await createDemoUser('AGENT_FODIP', 'Démo Agent');
    const comite = await createDemoUser('COMITE_FINANCEMENT', 'Démo Comité');
    const userIds = [direction.id, direction2.id, pme.id, agent.id, comite.id];

    try {
      // --- 1. Accueil institutionnel ---
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /Piloter le financement des PME guinéennes de la demande jusqu’à l’impact/ })).toBeVisible();
      await expect(page.locator('a[href="/connexion"]', { hasText: 'Accéder à la plateforme' })).toBeVisible();

      // --- 2. Connexion Direction + 3. MFA ---
      const directionSecret = await login(page, '/connexion', direction.email, password);
      expect(directionSecret, 'DIRECTION_FODIP is a privileged role - MFA enrollment was expected').toBeTruthy();
      await expect(page).toHaveURL(/\/direction\/tableau-de-bord$/);

      // --- 4. Cockpit national ---
      await expect(page.locator('[data-kpi-card]').getByText('Montant décaissé', { exact: true })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Portefeuille par région' })).toBeVisible();

      // --- 5. Filtre région ---
      const regionFilter = page.locator('#region');
      await regionFilter.selectOption({ index: 1 });
      await expect(page.locator('#main-content [role="alert"]')).toHaveCount(0);
      await expect(regionFilter).toHaveValue(/.+/);
      await page.getByText('Réinitialiser').click();

      await logout(page);
      await expect(page).toHaveURL(/\/connexion$/);

      // --- Deposit the dossier this demo will carry all the way to a live financing ---
      await login(page, '/connexion', pme.email, password);
      await expect(page).toHaveURL(/\/entrepreneur$/);
      await page.goto('/entrepreneur/demande');
      await page.getByLabel('Programme').selectOption({ label: 'Programme Croissance PME' });
      await page.getByRole('button', { name: 'Continuer' }).click();
      await expect(page.getByLabel('Étapes de la demande')).toContainText('2. Financement');
      await page.getByLabel('Montant demandé (GNF)').fill('300000000');
      await page.getByLabel('Objet du financement').fill('Démonstration Direction générale - ligne de production');
      await page.getByRole('button', { name: 'Continuer' }).click();
      await expect(page.getByLabel('Étapes de la demande')).toContainText('3. Projet');
      await page.getByRole('button', { name: 'Continuer' }).click();
      await expect(page.getByLabel('Étapes de la demande')).toContainText('4. Vérification');
      await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
      await expect(page).toHaveURL(/\/entrepreneur\/suivi$/);
      const ownRow = page.locator('table tbody tr').first();
      const numeroDossier = (await ownRow.locator('td').first().innerText()).trim();
      expect(numeroDossier).toMatch(/^FODIP-/);
      await ownRow.getByRole('button', { name: 'Soumettre' }).click();
      await expect(ownRow.getByText('Soumis', { exact: true })).toBeVisible();
      await logout(page);

      // --- 6. Dossier PME (agent's 360° view, instruction and transmission to committee) ---
      await login(page, '/connexion', agent.email, password);
      await expect(page).toHaveURL(/\/agent\/tableau-de-bord$/);
      await page.goto('/agent/dossiers?vue=A_PRENDRE');
      await page.getByRole('searchbox', { name: 'Recherche', exact: true }).fill(numeroDossier);
      await page.getByRole('button', { name: 'Filtrer' }).click();
      await page.getByRole('button', { name: 'Prendre et instruire' }).first().click();
      await expect(page).toHaveURL(/\/agent\/dossiers\/[0-9a-f-]+$/);
      const dossierUrl = page.url();
      await expect(page.getByRole('button', { name: 'Prendre en charge' })).toHaveCount(0);

      const scoringForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Calculer et enregistrer' }) });
      const noteInputs = scoringForm.getByRole('spinbutton');
      for (const input of await noteInputs.all()) await input.fill('80');
      await scoringForm.getByRole('button', { name: 'Calculer et enregistrer' }).click();
      await expect(page.getByText('Scoring calculé et enregistré.')).toBeVisible();

      await page.getByLabel('Décision d\'instruction').selectOption('PRET_COMITE');
      await page.getByLabel('Motivation de la décision').fill('Dossier complet, transmis pour la démonstration Direction.');
      await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
      const reviewDialog = page.getByRole('alertdialog', { name: 'Confirmer la décision d’instruction' });
      await expect(reviewDialog).toBeVisible();
      await reviewDialog.getByRole('button', { name: 'Confirmer la décision' }).click();
      await expect(page.getByText('Décision d’instruction enregistrée.')).toBeVisible();
      await logout(page);

      // --- 7. Décision comité ---
      await login(page, '/connexion', comite.email, password);
      await expect(page).toHaveURL(/\/comite\/tableau-de-bord$/);
      await page.goto(dossierUrl.replace('/agent/dossiers/', '/comite/dossiers/'));
      await expect(page.getByText('PRET_COMITE', { exact: true })).toBeVisible();
      await page.getByLabel('Décision').selectOption('APPROUVE');
      await expect(page.getByLabel('Montant approuvé (GNF)')).not.toHaveValue('');
      await page.getByLabel('Durée (mois)').fill('24');
      await page.getByLabel('Je confirme avoir relu le dossier').check();
      await page.getByRole('button', { name: 'Confirmer et enregistrer la décision' }).click();
      await expect(page.getByText('Décision du comité enregistrée et auditée.')).toBeVisible();
      await logout(page);

      // --- 8. Financement (Direction turns the approved decision into a live financing) ---
      await loginWithMfa(page, '/connexion', direction.email, password, directionSecret!);
      await expect(page).toHaveURL(/\/direction\/tableau-de-bord$/);

      await page.goto('/direction/financements');
      const optionValue = await page.locator('#application option', { hasText: numeroDossier }).getAttribute('value');
      expect(optionValue, `${numeroDossier} should be listed among the decisions awaiting a financing`).toBeTruthy();
      await page.getByLabel('Dossier approuvé').selectOption(optionValue!);
      await page.getByRole('button', { name: 'Créer le financement et l’échéancier' }).click();
      await expect(page.getByText(/^Financement FIN-.+ créé avec \d+ échéances\.$/)).toBeVisible();

      await page.locator('tr', { hasText: numeroDossier }).getByRole('link', { name: 'Gérer' }).click();
      await expect(page).toHaveURL(/\/direction\/financements\/[0-9a-f-]+$/);
      await expect(page.getByRole('heading', { name: /^FIN-/ })).toBeVisible();
      const financingUrl = page.url();

      // --- 9. Décaissements ---
      await page.getByLabel(/Montant à planifier/).fill('150000000');
      await page.getByRole('button', { name: 'Planifier' }).click();
      await expect(page.getByText('Décaissement planifié et audité.')).toBeVisible();

      // Maker-checker (axe E5): `direction` planned this disbursement, so `direction` cannot also
      // confirm it - a second Direction officer must. Switch to `direction2` for this one action,
      // then switch back to continue the rest of the demo as `direction`.
      await logout(page);
      await expect(page).toHaveURL(/\/connexion$/);
      const direction2Secret = await login(page, '/connexion', direction2.email, password);
      expect(direction2Secret, 'DIRECTION_FODIP is a privileged role - MFA enrollment was expected').toBeTruthy();
      await expect(page).toHaveURL(/\/direction\/tableau-de-bord$/);
      await page.goto(financingUrl);
      await expect(page.getByRole('heading', { name: /^FIN-/ })).toBeVisible();
      const disbursementRowAsChecker = page.locator('tbody tr', { hasText: 'PREVU' }).first();
      await disbursementRowAsChecker.getByLabel('Référence').fill('DEMO-DG-DEC-001');
      await disbursementRowAsChecker.getByRole('button', { name: 'Confirmer aujourd’hui' }).click();
      await expect(page.getByText('Décaissement confirmé et intégré au cockpit.')).toBeVisible();
      await logout(page);
      await expect(page).toHaveURL(/\/connexion$/);

      await loginWithMfa(page, '/connexion', direction.email, password, directionSecret!);
      await expect(page).toHaveURL(/\/direction\/tableau-de-bord$/);
      await page.goto(financingUrl);
      await expect(page.getByRole('heading', { name: /^FIN-/ })).toBeVisible();

      // --- 10. Remboursements ---
      await page.getByLabel('Montant payé').fill('5000000');
      await page.getByRole('button', { name: 'Enregistrer le paiement' }).click();
      await expect(page.getByText('Remboursement enregistré et échéance actualisée.')).toBeVisible();

      // --- 11. Suivi d'impact ---
      await page.getByLabel('Employés').fill('18');
      await page.getByLabel('Emplois créés').fill('4');
      await page.getByLabel('Emplois maintenus').fill('14');
      await page.getByRole('button', { name: 'Enregistrer l’impact' }).click();
      await expect(page.getByText('Snapshot d’impact enregistré.')).toBeVisible();
      await expect(page.locator('h2', { hasText: 'Historique d’impact' }).locator('..').getByText('18 employés')).toBeVisible();
    } finally {
      await Promise.all(userIds.map((id) => admin.patch(`/api/administration/users/${id}`, { data: { actif: false } }).catch(() => undefined)));
      await admin.dispose();
    }
  });
});
