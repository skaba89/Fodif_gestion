import { expect, test } from '@playwright/test';

test.describe('BFF CSRF boundary', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'HTTP policy coverage needs one desktop engine.');
  });

  test('rejects a mutation carrying a foreign Origin', async ({ request }) => {
    const response = await request.post('/api/session/login', {
      headers: { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
      data: { email: 'victim@example.org', password: 'not-forwarded' },
    });
    expect(response.status()).toBe(403);
    await expect(response.json()).resolves.toEqual({ message: 'Requête refusée par la protection CSRF.' });
  });

  test('serves the browser security baseline without framework disclosure', async ({ request }) => {
    const response = await request.get('/');
    expect(response.ok()).toBeTruthy();
    const headers = response.headers();
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['strict-transport-security']).toContain('max-age=31536000');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['permissions-policy']).toContain('camera=()');
    expect(headers['x-powered-by']).toBeUndefined();
  });

  test('moves the OIDC delivery token into HttpOnly state before React loads', async ({ request }) => {
    const response = await request.get('/api/session/oidc/callback?token=fake.header.signature', { maxRedirects: 0 });
    expect(response.status()).toBe(303);
    expect(response.headers().location).toMatch(/\/connexion\?oidc=continue$/);
    expect(response.headers().location).not.toContain('fake.header.signature');
    expect(response.headers()['set-cookie']).toContain('HttpOnly');
    expect(response.headers()['set-cookie']).toMatch(/samesite=strict/i);
    expect(response.headers()['referrer-policy']).toBe('no-referrer');
  });

  test('does not expose the access token in the login response', async ({ request, baseURL }) => {
    const response = await request.post('/api/session/login', {
      headers: { origin: new URL(baseURL!).origin, 'sec-fetch-site': 'same-origin' },
      data: { email: 'qualification-pme@fodip.local', password: 'FodipDemo2026!' },
    });
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    expect(payload.accessToken).toBeUndefined();
    expect(payload.user?.roles).toContain('PME');
    expect(response.headers()['set-cookie']).toContain('HttpOnly');
    expect(response.headers()['set-cookie']).toMatch(/samesite=strict/i);
  });
});
