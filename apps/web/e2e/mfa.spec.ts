import { APIRequestContext, expect, request as playwrightRequest, test } from '@playwright/test';
import * as OTPAuth from 'otpauth';

// End-to-end coverage for the TOTP flow itself: apps/api/src/auth/mfa/mfa.service.ts already has
// unit coverage with the real crypto/otpauth implementation, but nothing before this exercised
// the actual browser round trip (LoginForm's setup/verify steps) against a live stack. It also
// doubles as a regression test for the "privileged roles are always MFA-enrolled" enforcement in
// AdministrationRepository: the temporary account below is created WITHOUT mfaRequired in the
// payload, purely from a privileged role (COMITE_FINANCEMENT).
const DEMO_PASSWORD = 'FodipDemo2026!';
const TEST_PASSWORD = 'MfaE2E!Test2026';

function codeFor(secret: string): string {
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30, algorithm: 'SHA1' });
  return totp.generate();
}

async function createMfaEnrolledUser(baseURL: string): Promise<{ id: string; email: string; admin: APIRequestContext }> {
  const admin = await playwrightRequest.newContext({ baseURL });
  const login = await admin.post('/api/session/login', {
    data: { email: 'admin@fodip.local', password: DEMO_PASSWORD },
  });
  expect(login.ok(), 'admin login for test setup').toBeTruthy();

  const email = `mfa.e2e.${Date.now()}@fodip.local`;
  const created = await admin.post('/api/administration/users', {
    data: { email, nom: 'MFA E2E', password: TEST_PASSWORD, roles: ['COMITE_FINANCEMENT'] },
  });
  expect(created.ok(), 'creating the temporary MFA test account').toBeTruthy();
  const { id } = await created.json();
  return { id, email, admin };
}

test.describe('TOTP multi-factor authentication', () => {
  test('a privileged account is auto-enrolled, completes setup, then verifies on next login', async ({ page, baseURL }) => {
    const { id, email, admin } = await createMfaEnrolledUser(baseURL!);

    try {
      // --- First login: no confirmed secret yet -> enrollment challenge ---
      await page.goto('/comite/connexion');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Mot de passe').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Se connecter' }).click();

      await expect(page.getByText('double authentification')).toBeVisible();
      const secret = (await page.locator('code').innerText()).trim();
      expect(secret).toMatch(/^[A-Z2-7]+=*$/);

      await page.getByLabel('Code à 6 chiffres').fill(codeFor(secret));
      await page.getByRole('button', { name: 'Activer et se connecter' }).click();

      await expect(page).toHaveURL(/\/comite\/dossiers$/);
      await expect(page.getByText(email)).toBeVisible();

      // --- Log out and back in: the secret is now confirmed -> verification challenge only ---
      await page.getByRole('button', { name: 'Déconnexion' }).click();
      await expect(page).toHaveURL(/\/comite\/connexion$/);

      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Mot de passe').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Se connecter' }).click();

      await expect(page.getByText('Saisissez le code à 6 chiffres')).toBeVisible();
      await expect(page.locator('code')).toHaveCount(0);

      await page.getByLabel('Code à 6 chiffres').fill(codeFor(secret));
      await page.getByRole('button', { name: 'Se connecter' }).click();

      await expect(page).toHaveURL(/\/comite\/dossiers$/);
    } finally {
      await admin.patch(`/api/administration/users/${id}`, { data: { actif: false } }).catch(() => undefined);
      await admin.dispose();
    }
  });

  test('an invalid code is rejected without completing enrollment', async ({ page, baseURL }) => {
    const { id, email, admin } = await createMfaEnrolledUser(baseURL!);

    try {
      await page.goto('/comite/connexion');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Mot de passe').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Se connecter' }).click();
      await expect(page.locator('code')).toBeVisible();

      await page.getByLabel('Code à 6 chiffres').fill('000000');
      await page.getByRole('button', { name: 'Activer et se connecter' }).click();

      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page).toHaveURL(/\/comite\/connexion$/);
    } finally {
      await admin.patch(`/api/administration/users/${id}`, { data: { actif: false } }).catch(() => undefined);
      await admin.dispose();
    }
  });
});
