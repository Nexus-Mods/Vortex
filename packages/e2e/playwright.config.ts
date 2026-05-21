import { existsSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "@playwright/test";

const envFilePath = path.resolve(import.meta.dirname, ".env");

if (existsSync(envFilePath)) {
  process.loadEnvFile(envFilePath);
}

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  retries: 1,
  reporter: [
    ["list"],
    [
      "html",
      { open: "never", outputFolder: path.resolve(import.meta.dirname, "playwright-report") },
    ],
    ["junit", { outputFile: "test-results/junit.xml" }],
    ...(process.env.CI ? [["github"] as const] : []),
  ],
  use: {
    actionTimeout: 5_000,
    navigationTimeout: 5_000,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "on-first-retry",
  },
});
