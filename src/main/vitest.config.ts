import { mergeConfig, defineConfig } from "vitest/config";

import baseConfig from "../../vitest.base.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: "@vortex/main",
      environment: "node",
      include: ["src/**/*.test.ts", "*.test.ts", "subset_symbols/*.test.ts"],
      setupFiles: "./src/test-setup.ts",
    },
  }),
);
