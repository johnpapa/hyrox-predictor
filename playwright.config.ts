import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;

/**
 * End-to-end tests run against the production build (strict CSP, relative base href)
 * served under /hyrox-predictor/, the same way GitHub Pages hosts it.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: process.env['CI'] ? 2 : 3,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/hyrox-predictor/`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } }, testIgnore: /tutorial/ },
    { name: 'iphone', use: { ...devices['iPhone 14'], browserName: 'chromium' }, testIgnore: /tutorial/ },
    // Regenerates the screenshots in docs/tutorial — run with `npm run docs:screenshots`.
    { name: 'tutorial', testMatch: /tutorial\.ts/, use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node e2e/serve.mjs',
    url: `http://localhost:${PORT}/hyrox-predictor/`,
    reuseExistingServer: !process.env['CI'],
    env: { PORT: String(PORT) },
  },
});
