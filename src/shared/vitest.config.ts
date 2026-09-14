import { doctest } from "vite-plugin-doctest";
import { mergeConfig, defineConfig } from "vitest/config";

import baseConfig from "../../vitest.base.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [doctest()],
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
      includeSource: ["src/fs/paths.ts", "src/fs/matcher.ts"],
    },
  }),
);
