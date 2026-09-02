import { expect, request as playwrightRequest, test } from '@playwright/test';

// Axe B5 (docs/14-ROADMAP-SAAS-PREMIUM.md): utilisateurs.telephone is stored as an AES-256-GCM
// ciphertext (apps/api/src/administration/administration.repository.ts,
// database/013_pii_encryption.sql), not plaintext. Repository-level unit tests
// (apps/api/test/administration.repository.spec.ts, data-rights.repository.spec.ts) already prove
// the encrypt/decrypt round-trip against a mocked database - this is the one check that exercises
// it against a real Postgres column (widened from VARCHAR(50); a wrong length calculation would
// truncate the ciphertext and fail here, not in a mock) and the real pg driver's encoding.
const DEMO_PASSWORD = 'FodipDemo2026!';

test('a user telephone round-trips through encryption at rest unchanged (axe B5)', async ({ baseURL }) => {
  const admin = await playwrightRequest.newContext({ baseURL });
  try {
    const login = await admin.post('/api/session/login', { data: { email: 'admin@fodip.local', password: DEMO_PASSWORD } });
    expect(login.ok(), 'admin login for test setup').toBeTruthy();

    const email = `pii.e2e.${Date.now()}@fodip.local`;
    const telephone = '+224622987654';
    const created = await admin.post('/api/administration/users', {
      data: { email, nom: 'PII E2E', telephone, password: 'PiiE2E!Test2026', roles: ['AGENT_FODIP'] },
    });
    expect(created.ok(), 'creating the temporary test account').toBeTruthy();
    const { id } = await created.json();

    try {
      const listed = await admin.get(`/api/administration/users?search=${encodeURIComponent(email)}`);
      expect(listed.ok()).toBeTruthy();
      const { items } = await listed.json();
      const account = items.find((item: { email: string }) => item.email === email);
      expect(account?.telephone).toBe(telephone);
    } finally {
      await admin.patch(`/api/administration/users/${id}`, { data: { actif: false } }).catch(() => undefined);
    }
  } finally {
    await admin.dispose();
  }
});
