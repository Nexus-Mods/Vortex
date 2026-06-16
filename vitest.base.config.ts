import { defineConfig } from "vitest/config";

const isGitHubCI = process.env.CI && process.env.GITHUB_ACTIONS;

export default defineConfig({
  test: {
    reporters: ["default", isGitHubCI ? "github-actions" : undefined].filter(Boolean) as string[],
  },
});
