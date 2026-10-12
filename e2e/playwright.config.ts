import { defineConfig } from '@playwright/test';

// Runs against real Gmail with one signed-in profile, so tests must run one at a time.
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: '../test-results',
  use: {
    // Without this, a missing Gmail element blocks until the 90s test timeout
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
