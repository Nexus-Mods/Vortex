import { createRequire } from "node:module";

import { mergeConfig, defineConfig } from "vitest/config";

import baseConfig from "../../vitest.base.config";

const require_ = createRequire(import.meta.url);
const VORTEX_API_MOCK = require_.resolve("@vortex/extension-test-mocks");

export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: [{ find: /^@nexusmods\/vortex-api$/, replacement: VORTEX_API_MOCK }],
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  }),
);
