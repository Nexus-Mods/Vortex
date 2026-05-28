import { mergeConfig, defineConfig } from "vitest/config";

import baseConfig from "../../vitest.base.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: "@vortex/main (downloader)",
      environment: "node",
      include: ["src/downloading/*.test.integration.ts"],
      testTimeout: 30_000,
    },
  }),
);
