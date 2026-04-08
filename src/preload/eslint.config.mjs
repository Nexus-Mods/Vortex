import { defineConfig } from "eslint/config";

import { baseConfig } from "../../eslint.config.base.mjs";

<<<<<<< HEAD
export default defineConfig([...baseConfig(import.meta.dirname)]);
=======
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
        tsconfigRootDir: import.meta.dirname,
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
>>>>>>> 4a6585a85 (Merge pull request #22281 from Nexus-Mods/_v2.0-tools)
