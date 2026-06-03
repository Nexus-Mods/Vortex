import { defineConfig } from "eslint/config";

import { baseConfig } from "../../eslint.config.base.mjs";

export default defineConfig([
  ...baseConfig(import.meta.dirname, [
    "tests/**/*.ts",
    "fixtures/**/*.ts",
    "selectors/**/*.ts",
    "helpers/**/*.ts",
    "playwright.config.ts",
  ]),
]);
