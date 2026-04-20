import { defineConfig } from "eslint/config";
import globals from "globals";

import { baseConfig } from "../../eslint.config.base.mjs";

export default defineConfig([
  ...baseConfig(import.meta.dirname),
  {
    files: ["src/node/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
]);
