import { expect, test } from '@playwright/test';

// Axe D2 (docs/14-ROADMAP-SAAS-PREMIUM.md): PWA installability and the offline fallback shell.
//
// A genuine "go offline and navigate" scenario was tried first and dropped: neither
// context.setOffline(true) nor context.route(...).abort() actually reach a request the service
// worker itself issues from inside its fetch handler (both only intercept requests the *page*
// makes directly) - confirmed empirically in this environment, not assumed - so a real offline
// navigation always came back with live content instead of exercising the fallback at all, a
// false pass that would hide a broken service worker just as easily as a working one. What is
// reliably testable, and what this spec checks instead: the manifest and icons are served and
// linked, the service worker registers and takes control, it caches exactly the app shell it
// declares (docs/17-METRIQUES-OBSERVABILITE.md's counterpart for D2 - see docs/14 for the D2
// write-up), and the cached offline document is the real /hors-ligne page content. Combined with
// a direct code read of public/sw.js's fetch handler (network-first navigation, falling back to
// `caches.match(OFFLINE_URL)` on failure), this is the honest ceiling of automated verification
// here.
test.describe('PWA (axe D2)', () => {
  test('the web app manifest is served and linked from the home page', async ({ page, request }) => {
    await page.goto('/');
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBe('/manifest.webmanifest');

    const response = await request.get(manifestHref!);
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.name).toBe('FODIP Digital 2030');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(true);

    for (const icon of manifest.icons) {
      const iconResponse = await request.get(icon.src);
      expect(iconResponse.ok(), `icon ${icon.src} should be served`).toBe(true);
    }
  });

  test('the service worker registers, takes control, and caches the offline app shell', async ({ page }) => {
    await page.goto('/');
    const registration = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return { scope: reg.scope, active: Boolean(reg.active) };
    });
    expect(registration.active).toBe(true);
    expect(registration.scope).toBe(new URL('/', page.url()).toString());

    // Give the install handler's cache.addAll(...) a moment to settle.
    await expect(async () => {
      const cached = await page.evaluate(async () => {
        const results: Record<string, number | 'MISSING'> = {};
        for (const url of ['/hors-ligne', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']) {
          const response = await caches.match(url);
          results[url] = response ? response.status : 'MISSING';
        }
        return results;
      });
      expect(cached).toEqual({
        '/hors-ligne': 200,
        '/manifest.webmanifest': 200,
        '/icons/icon-192.png': 200,
        '/icons/icon-512.png': 200,
      });
    }).toPass({ timeout: 5000 });
  });

  test('the cached offline document is the real /hors-ligne fallback page', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    // Poll rather than read once: install-time caching (cache.addAll in public/sw.js) runs
    // asynchronously and may not have finished the instant navigator.serviceWorker.ready
    // resolves.
    const readCachedOfflineText = () =>
      page.evaluate(async () => {
        const cached = await caches.match('/hors-ligne');
        return cached ? cached.text() : null;
      });
    await expect.poll(readCachedOfflineText, { timeout: 5000 }).not.toBeNull();

    const text = await readCachedOfflineText();
    expect(text).toContain('Vous êtes hors ligne');
    expect(text).toContain('Réessayer');

    // The live page (reached over the network, not the cache) matches what got cached.
    await page.goto('/hors-ligne');
    await expect(page.getByRole('heading', { name: 'Vous êtes hors ligne' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  });
});
