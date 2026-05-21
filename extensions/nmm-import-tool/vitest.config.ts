import * as path from "node:path";

import { mergeConfig, defineConfig } from "vitest/config";

import baseConfig from "../../vitest.base.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: {
        "@nexusmods/vortex-api": path.resolve(import.meta.dirname, "__mocks__/vortex-api.ts"),
        "modmeta-db": path.resolve(import.meta.dirname, "__mocks__/modmeta-db.ts"),
      },
    },
    test: {
      environment: "happy-dom",
      include: ["src/**/*.test.ts"],
    },
  }),
);
