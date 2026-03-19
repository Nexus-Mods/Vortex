import eslint from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import perfectionist from "eslint-plugin-perfectionist";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: ["node_modules/**"],
  },

  {
    files: ["src/**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      prettierConfig,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      perfectionist,
    },
    rules: {
      // Perfectionist
      "perfectionist/sort-imports": "warn",
      "perfectionist/sort-exports": "warn",

      // Typescript
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      // NOTE: remove after fixing the warnings
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
    },
  },

  {
    files: ["*.mjs"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      prettierConfig,
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
    plugins: { perfectionist },
    rules: {
      // Perfectionist
      "perfectionist/sort-imports": "warn",
      "perfectionist/sort-exports": "warn",
    },
  },
]);
