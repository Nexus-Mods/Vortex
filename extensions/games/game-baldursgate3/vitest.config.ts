import { mergeConfig, defineConfig } from "vitest/config";

import baseConfig from "../../../vitest.base.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
      // divine.exe invocations can be slow on cold caches.
      testTimeout: 30000,
      hookTimeout: 30000,
    },
  }),
);
