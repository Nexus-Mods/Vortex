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
  // Each worker launches its own Electron instance with isolated user data.
  // CI: Windows runners are slower (1 worker), Linux can handle 2.
  // Local: 4 workers.
  workers: process.env.CI ? (process.platform === "win32" ? 1 : 2) : 4,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],
  use: {
    actionTimeout: 5_000,
    navigationTimeout: 5_000,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "on-first-retry",
  },
});
