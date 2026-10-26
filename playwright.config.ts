import { defineConfig } from '@playwright/test';

const PORT = 3114;

/**
 * End-to-end tests of the built app, served by the same Express server that runs locally and on AI Studio.
 * The catalog APIs are stubbed per test (tests/e2e/fixtures.ts), so nothing depends on Deezer, YouTube or the network.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // iPhone 11, the target device
    viewport: { width: 414, height: 896 },
    colorScheme: 'dark',
    // The app's service worker fetches on its own, which page.route cannot see: with it on, the stubs are bypassed
    // and the tests would reach the real Deezer
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  },
  webServer: {
    // CI builds in its own step, so the server only needs to start there
    command: `${process.env.E2E_SKIP_BUILD ? '' : 'npm run build && '}npx tsx server.ts`,
    env: { PORT: String(PORT), NODE_ENV: 'production' },
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  }
});
