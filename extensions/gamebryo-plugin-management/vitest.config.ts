import * as path from "node:path";

import { mergeConfig, defineConfig } from "vitest/config";

import baseConfig from "../../vitest.base.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: {
        // the real package is types-only outside the bundled app; tests resolve the
        // vortex-api surface from the fixture stand-in instead
        "@nexusmods/vortex-api": path.resolve(import.meta.dirname, "test-utils/vortex-api.ts"),
      },
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  }),
);
