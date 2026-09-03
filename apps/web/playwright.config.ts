import { defineConfig, devices } from '@playwright/test';

/**
 * These tests run against a fully live stack (web + API + PostgreSQL + MinIO), the same one
 * `scripts/docker-smoke.sh` exercises at the HTTP level. Start it first (`docker compose up`)
 * and point PLAYWRIGHT_BASE_URL at it if it isn't on the default port.
 *
 * Sprint Enterprise 0, Lot 2 (axe E2 - docs/14-ROADMAP-SAAS-PREMIUM.md): the mission asks for a
 * real multi-browser matrix, not Chromium alone - form autofill, service worker registration
 * (pwa.spec.ts) and clipboard-adjacent input handling all vary by engine (Chromium/Blink,
 * Firefox/Gecko, Safari/WebKit). `workers: 1` stays global (not per-project) deliberately: every
 * project exercises the same live demo accounts and dossiers against one shared backend (no
 * per-test database reset like the API's integration specs), so two projects running concurrently
 * could race on the same seeded data - this keeps every project's tests, across the whole matrix,
 * running one at a time exactly as before this matrix was added.
 *
 * `firefox`/`webkit` deliberately run a NARROWER set of specs than `chromium` - HEAVY_LOGIN_SPECS
 * below. Found the hard way, not guessed: a first version ran all 17 specs on all three projects
 * and firefox/webkit both failed, deterministically, not flakily - real logins started coming back
 * "Connexion impossible" / bouncing straight to the login page. Root cause: `/auth/login` is
 * rate-limited to 5 attempts per email per 60s (`@Throttle` in
 * apps/api/src/auth/auth.controller.ts, `trackLoginByEmail`) - a real security control, working as
 * intended, that accessibility.spec.ts's own comment already documents designing around *within* a
 * single project (choosing `auditeur@fodip.local` specifically so its one login doesn't share
 * `pme@fodip.local`'s budget with login.spec.ts/workflow.spec.ts). Replaying `login.spec.ts`,
 * `workflow.spec.ts`, `mfa.spec.ts` and `pii-encryption.spec.ts` on three sequential projects
 * within the same ~2.5 minute run reuses `agent@fodip.local`/`pme@fodip.local`/`admin@fodip.local`
 * often enough (3 real POSTs per project x 3 projects, all within one sliding 60s window) to trip
 * that same limit for real - not a bug to work around, the rate limiter doing its job against
 * traffic that happens to be Playwright rather than a credential-stuffing attempt. Weakening it
 * (raising the limit, disabling it under CI) was rejected: it is exactly the kind of control this
 * mission asks to hold to a stricter, not looser, standard. accessibility.spec.ts,
 * direction-partenaire.spec.ts and pwa.spec.ts stay in HEAVY_LOGIN_SPECS's complement (light or no
 * login use, verified safe under the exact same replay) and run on the full matrix.
 *
 * Mobile device emulation (Android/iPhone, the matrix's other half) was deliberately left out of
 * this file until mission "présentation Directeur général" (section 6): enabling it first turned
 * up real, pre-existing bugs, not test-harness noise - below ~900px/~680px (depending on portal),
 * every portal's layout set its whole navigation to `display: none` with no hamburger/drawer
 * replacement, making the page unusable, not just visually different, past that breakpoint. That
 * bug is now fixed (see AppShell.tsx, Drawer.tsx) and verified across all 7 portals at 375px, so
 * the two mobile projects below are real coverage now, not a placeholder. `Pixel 7` runs on the
 * `chromium` engine (Android device emulation in Playwright always does; there is no separate
 * Android browser engine) so it needs no extra browser install beyond `chromium` itself. `iPhone
 * 14` runs on `webkit` (Mobile Safari emulation always does) - CI already installs it
 * (`playwright install --with-deps chromium firefox webkit`); running this project locally
 * requires that same install.
 */
// Specs that log in as agent@/pme@/admin@fodip.local enough times per run to matter for the
// shared 5-per-60s throttle once replayed across projects - see the file-level comment above.
const HEAVY_LOGIN_SPECS = [
  /login\.spec\.ts$/, /workflow\.spec\.ts$/, /mfa\.spec\.ts$/, /pii-encryption\.spec\.ts$/,
  // Mission "présentation Directeur général" (section 10): logs in as pme@/agent@/comite@ - the
  // same three accounts workflow.spec.ts already uses - so it carries the same profile.
  /executive-demo\.spec\.ts$/,
];

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
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: HEAVY_LOGIN_SPECS },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: HEAVY_LOGIN_SPECS },
    // Mobile matrix (mission "présentation Directeur général", section 6 and 10) - same
    // HEAVY_LOGIN_SPECS exclusion as firefox/webkit above, for the same reason: five projects all
    // replaying login.spec.ts/workflow.spec.ts/mfa.spec.ts/pii-encryption.spec.ts within one run
    // would trip the shared 5-attempts/60s login throttle even harder than three already do.
    { name: 'Pixel 7', use: { ...devices['Pixel 7'] }, testIgnore: HEAVY_LOGIN_SPECS },
    { name: 'iPhone 14', use: { ...devices['iPhone 14'] }, testIgnore: HEAVY_LOGIN_SPECS },
  ],
});
