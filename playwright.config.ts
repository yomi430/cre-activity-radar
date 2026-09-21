import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // Full public snapshots contain roughly 400k permit rows. Keep browser assertions
  // strict, but allow complete-snapshot API queries to finish on reviewer hardware.
  timeout: 60_000,
  expect: { timeout: 30_000 },
  use: { baseURL: 'http://127.0.0.1:3001', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm.cmd run start',
    url: 'http://127.0.0.1:3001/api/health',
    reuseExistingServer: true,
    timeout: 30_000
  }
});
