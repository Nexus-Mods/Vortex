import path from "node:path";

import { defineConfig } from "@playwright/test";

import { loadE2EEnv } from "./src/helpers/env";
import { GlobalTimeouts, Timeouts } from "./src/helpers/timeouts";

loadE2EEnv();

export default defineConfig({
  testDir: "./src/tests",
  grep: process.env.VORTEX_E2E_GREP ? new RegExp(process.env.VORTEX_E2E_GREP) : undefined,
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
