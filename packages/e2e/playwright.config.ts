import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Per-test timeout (excludes fixture setup)
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: 0,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
});
