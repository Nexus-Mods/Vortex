import { defineConfig } from "eslint/config";

import { baseConfig } from "../../eslint.config.base.mjs";

export default defineConfig([
  ...baseConfig(import.meta.dirname),
  {
    files: ["src/**/*.ts"],
<<<<<<< HEAD
=======
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
>>>>>>> 4a6585a85 (Merge pull request #22281 from Nexus-Mods/_v2.0-tools)
    rules: {
      // NOTE: remove after fixing the warnings
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
    },
  },
]);
