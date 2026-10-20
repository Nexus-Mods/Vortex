import * as path from "node:path";

import { mergeConfig } from "vitest/config";

import rendererConfig from "../../src/renderer/vitest.config.mts";
import baseConfig from "../../vitest.base.config";

const rendererRoot = path.resolve(import.meta.dirname, "../../src/renderer");

export default mergeConfig(
  mergeConfig(baseConfig, { ...rendererConfig, test: { ...rendererConfig.test, setupFiles: [] } }),
  {
    resolve: {
      alias: [
        {
          find: /^@nexusmods\/vortex-api$/,
          replacement: path.join(rendererRoot, "src/api.ts"),
        },
      ],
    },
    test: {
      name: "mod-dependency-manager",
      setupFiles: [path.join(rendererRoot, "test-setup.mts")],
      include: ["src/**/*.test.ts"],
    },
  },
);
