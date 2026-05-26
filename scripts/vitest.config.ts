import { mergeConfig, defineConfig } from "vitest/config";

import baseConfig from "../vitest.base.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: "scripts",
      environment: "node",
      include: ["**/*.test.ts"],
    },
  }),
);
