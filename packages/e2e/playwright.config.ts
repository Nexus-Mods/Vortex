import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: 1,
  // Each worker launches its own Electron instance with isolated user data.
  // CI runners have fewer resources — use 2 workers there, 4 locally.
  workers: process.env.CI ? 2 : 4,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],
  use: {
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "on-first-retry",
  },
});
