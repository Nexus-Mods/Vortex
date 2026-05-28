import * as path from "node:path";

import { mergeConfig, defineConfig } from "vitest/config";

import baseConfig from "../../vitest.base.config";

const mock = (name: string) => path.resolve(import.meta.dirname, `__mocks__/${name}.ts`);

export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: {
        "original-fs": "fs",
        "@nexusmods/vortex-api": mock("vortex-api"),
      },
    },
    test: {
      environment: "happy-dom",
      setupFiles: ["./test-setup.ts"],
      include: ["src/**/*.test.ts"],
    },
  }),
);
