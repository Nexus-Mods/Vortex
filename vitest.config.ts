import * as path from "node:path";
import { defineConfig } from "vitest/config";

const RESULTS_DIR = path.join(import.meta.dirname, "test-results");

const isGitHubCI = process.env.CI && process.env.GITHUB_ACTIONS;

export default defineConfig({
  test: {
    projects: [
      "./src/main",
      "./scripts",
      "./src/main/vitest.integration.config.ts",
      "./src/renderer",
      "./src/shared",
      "./packages/adaptor-api",
      "./packages/adaptors/ping-test",
      "./packages/fs",
      "./extensions/feedback",
      "./extensions/gamebryo-savegame-management",
      "./extensions/nmm-import-tool",
      "./extensions/games/game-stardewvalley",
    ],
    reporters: [
      "default",
      "junit",
      isGitHubCI ? "github-actions" : undefined,
    ].filter(Boolean),
    outputFile: {
      junit: path.join(RESULTS_DIR, "junit.xml"),
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "cobertura"],
      reportsDirectory: path.join(RESULTS_DIR),
    },
  },
});
