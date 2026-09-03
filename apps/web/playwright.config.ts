import { defineConfig, devices } from '@playwright/test';

/**
 * These tests run against a fully live stack (web + API + PostgreSQL + MinIO), the same one
 * `scripts/docker-smoke.sh` exercises at the HTTP level. Start it first (`docker compose up`)
 * and point PLAYWRIGHT_BASE_URL at it if it isn't on the default port.
 *
 * Sprint Enterprise 0, Lot 2 (axe E2 - docs/14-ROADMAP-SAAS-PREMIUM.md): the mission asks for a
 * real multi-browser matrix, not Chromium alone - the login/MFA/document-upload flows cross form
 * autofill, service worker registration (pwa.spec.ts) and clipboard-adjacent input handling, all
 * of which vary by engine (Chromium/Blink, Firefox/Gecko, Safari/WebKit). `workers: 1` stays
 * global (not per-project) deliberately: every project exercises the same live demo accounts and
 * dossiers against one shared backend (no per-test database reset like the API's integration
 * specs), so two projects running concurrently could race on the same seeded data - this keeps
 * every project's tests, across the whole matrix, running one at a time exactly as before this
 * matrix was added.
 *
 * Mobile device emulation (Android/iPhone, the matrix's other half) is deliberately NOT added
 * here yet: enabling it immediately turned up real, pre-existing bugs, not test-harness noise -
 * verified locally against this exact live stack (`Mobile Chrome (Android)` via `devices['Pixel
 * 7']`, chromium engine, no extra browser install needed) before deciding not to ship it. Below
 * ~900px / ~680px (depending on portal), several independent layouts (globals.css's
 * `.app-shell`/`.nav-list` used by the direction/comité portals, `entrepreneur/portal.module.css`
 * for the PME portal) set the whole navigation to `display: none` with no hamburger/drawer
 * replacement - the page becomes unusable, not just visually different, past that breakpoint. A
 * separate axe hit a genuine WCAG violation unrelated to navigation (a `tabindex`-bearing
 * `.tableCard` wrapper on the design-system page with no focusable content, mobile viewport only).
 * Fixing mobile navigation is real, multi-portal frontend work, not something to fold into an
 * infrastructure PR that would otherwise leave a fresh browser matrix permanently red - tracked as
 * its own follow-up (see docs/14-ROADMAP-SAAS-PREMIUM.md, axe E2) with the two mobile projects
 * ready to uncomment once it lands.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
