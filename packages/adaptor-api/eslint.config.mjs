import { baseConfig } from "../../eslint.config.base.mjs";

import { defineConfig } from "eslint/config";

export default defineConfig([...baseConfig(import.meta.dirname)]);

