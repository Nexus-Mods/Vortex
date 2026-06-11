import { mergeConfig, defineConfig } from "vitest/config";

import baseConfig from "../../vitest.base.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: "@vortex/main (integration)",
      environment: "node",
      include: ["src/**/*.test.integration.ts"],
      testTimeout: 30_000,
    },
  }),
);
