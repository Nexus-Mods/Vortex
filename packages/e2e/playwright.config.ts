import { existsSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "@playwright/test";

import { GlobalTimeouts, Timeouts } from "./src/helpers/timeouts";

const envFilePath = path.resolve(import.meta.dirname, ".env");

if (existsSync(envFilePath)) {
  process.loadEnvFile(envFilePath);
}

export default defineConfig({
  testDir: "./src/tests",
  globalTimeout: GlobalTimeouts.GLOBAL,
  timeout: Timeouts.LIFECYCLE,
  expect: {
    timeout: GlobalTimeouts.EXPECT,
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
    actionTimeout: GlobalTimeouts.ACTION,
    navigationTimeout: GlobalTimeouts.NAVIGATION,
    screenshot: "off",
    video: "off",
    trace: "off",
  },
});
