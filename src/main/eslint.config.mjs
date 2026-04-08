import { defineConfig } from "eslint/config";
import globals from "globals";

import { baseConfig } from "../../eslint.config.base.mjs";

export default defineConfig([
  ...baseConfig(import.meta.dirname),
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
<<<<<<< HEAD
=======
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      perfectionist,
>>>>>>> 4a6585a85 (Merge pull request #22281 from Nexus-Mods/_v2.0-tools)
    },
    rules: {
      // TODO: to be removed after warnings have been fixed
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
    },
  },
]);
