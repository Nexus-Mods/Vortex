import { defineConfig, type OxlintConfig } from "oxlint";

const config: OxlintConfig = defineConfig({
  plugins: ["eslint", "typescript", "unicorn", "oxc", "vitest"],

  categories: {
    correctness: "error",
    suspicious: "error",
    perf: "warn"
  }
});

export default config;
