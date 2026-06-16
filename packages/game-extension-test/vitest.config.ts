import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { mergeConfig, defineConfig } from "vitest/config";

import baseConfig from "../../vitest.base.config";

const require_ = createRequire(import.meta.url);
const VORTEX_API_MOCK = require_.resolve("@vortex/extension-test-mocks");

// GDL-generated extensions import the runtime via the `@gdl/runtime` webpack
// alias. The harness loads the generated TS (not the webpack bundle), so map
// the same specifier to the submodule's runtime source.
const here = path.dirname(fileURLToPath(import.meta.url));
const GDL_RUNTIME = path.resolve(here, "../../game-description-language/src/runtime/index.ts");

export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: [
        { find: /^@nexusmods\/vortex-api$/, replacement: VORTEX_API_MOCK },
        { find: /^@gdl\/runtime$/, replacement: GDL_RUNTIME },
      ],
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  }),
);
