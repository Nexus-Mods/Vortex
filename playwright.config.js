import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './playwright/tests',
  timeout: process.env.CI ? 120000 : 60000, // 2 minutes on CI, 1 minute locally
  outputDir: './playwright/test-results', 
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright/playwright-report' }],
    ['list'], // Better console output for debugging
  ],
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    // CI-specific settings
    ...(process.env.CI && {
      screenshot: 'on', // Take screenshots on CI for debugging
      video: 'on',      // Record video on CI
    }),
  },
});