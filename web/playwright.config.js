// Browser tests against the local Supabase stack: `npm test` (see e2e/README.md).
// They run one after another in a single browser, which is plenty for a suite
// this size and keeps the auth server's per-IP rate limits out of the picture.
import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

if (!existsSync(new URL('./js/config.local.js', import.meta.url))) {
  throw new Error('js/config.local.js is missing: point it at the local stack (`npx supabase status`) before running the tests. See README.md.');
}

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:8080',
    browserName: 'chromium',
    viewport: { width: 420, height: 800 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node server.js',
    url: 'http://localhost:8080/',
    reuseExistingServer: true,
  },
});
