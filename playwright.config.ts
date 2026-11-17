import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI === 'true' ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 430, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'yarn build && yarn preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: process.env.CI !== 'true',
    timeout: 180_000,
  },
});
