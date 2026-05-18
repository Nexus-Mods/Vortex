import eslint from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import perfectionist from "eslint-plugin-perfectionist";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export const baseConfig = (tsconfigRootDir) =>
  defineConfig([
    {
      ignores: ["node_modules/**", "dist/**", "out/**", "temp/**", "coverage/**", "build/**"],
    },

    {
      files: ["src/**/*.{ts,tsx}"],
      extends: [
        eslint.configs.recommended,
        tseslint.configs.recommendedTypeChecked,
        prettierConfig,
      ],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: tsconfigRootDir,
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
          "warn",
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
      },
    },

    {
      files: ["*.mjs"],
      extends: [eslint.configs.recommended, tseslint.configs.recommended, prettierConfig],
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
