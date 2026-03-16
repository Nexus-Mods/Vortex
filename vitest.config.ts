import * as path from "node:path";
import { defineConfig } from "vitest/config";

const RESULTS_DIR = path.join(import.meta.dirname, "test-results");

const isGitHubCI = process.env.CI && process.env.GITHUB_ACTIONS;

export default defineConfig({
  test: {
    projects: ["./src/main", "./src/renderer", "./src/shared"],
    reporters: ["default", "junit", isGitHubCI ? "github-actions" : undefined].filter(Boolean),
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
