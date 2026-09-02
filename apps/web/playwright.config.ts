import { defineConfig, devices } from '@playwright/test';

/**
 * These tests run against a fully live stack (web + API + PostgreSQL + MinIO), the same one
 * `scripts/docker-smoke.sh` exercises at the HTTP level. Start it first (`docker compose up`)
 * and point PLAYWRIGHT_BASE_URL at it if it isn't on the default port.
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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
