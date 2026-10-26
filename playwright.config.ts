import { defineConfig } from '@playwright/test';

import { MOCK_PORT, MOCK_URL, TEST_ANON_KEY } from './tests/e2e/supabaseMock';

const PORT = 3114;

/**
 * End-to-end tests of the built app, served by the same Express server that runs locally and on AI Studio.
 * The catalog APIs are stubbed per test (tests/e2e/fixtures.ts), so nothing depends on Deezer, YouTube or the network.
 * Login talks to a mock of the Supabase Auth API (tests/e2e/supabaseMock.ts); the app is built with --mode e2e so
 * its public Supabase settings point at that mock.
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
  webServer: [
    {
      command: 'npx tsx tests/e2e/supabaseMockServer.ts',
      url: `http://localhost:${MOCK_PORT}/health`,
      reuseExistingServer: !process.env.CI
    },
    {
      // CI builds in its own step, so the server only needs to start there
      command: `${process.env.E2E_SKIP_BUILD ? '' : 'npm run build:e2e && '}npx tsx server.ts`,
      env: {
        PORT: String(PORT),
        NODE_ENV: 'production',
        DATABASE_VITE_SUPABASE_URL: MOCK_URL,
        DATABASE_VITE_SUPABASE_ANON_KEY: TEST_ANON_KEY
      },
      url: `http://localhost:${PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000
    }
  ]
});
