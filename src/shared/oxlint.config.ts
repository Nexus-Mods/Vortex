import { builtinModules } from "node:module";
import { defineConfig, type OxlintConfig } from "oxlint";

const config: OxlintConfig = defineConfig({
  plugins: ["eslint", "typescript", "unicorn", "oxc", "vitest", "promise"],

  ignorePatterns: ["oxlint.config.ts"],

  categories: {
    correctness: "error",
    suspicious: "error",
    perf: "warn",
  },

  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["node:*"],
            message:
              "Node.js built-ins are not allowed in the shared package. This package must be platform-agnostic.",
          },
        ],
        paths: builtinModules.map((m) => {
          return {
            name: m,
            message:
              "Node.js built-ins are not allowed in the shared package. This package must be platform-agnostic.",
          };
        }),
      },
    ],
  },
});

export default config;
