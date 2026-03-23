import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: 0,
  // Each test file runs in its own worker. Tests within the same file share
  // the Electron instance when using test.describe.serial or the same fixture.
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
});
