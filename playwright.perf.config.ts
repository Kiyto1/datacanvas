import { defineConfig, devices } from '@playwright/test';

// Browser benchmarks: same production build and CSP as the e2e suite, run serially for stable timings.
export default defineConfig({
  testDir: 'e2e',
  testMatch: /perf\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
