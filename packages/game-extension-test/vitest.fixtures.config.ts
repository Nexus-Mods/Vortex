import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Vitest config for the dynamic fixture runner driven by `cli.ts`. Each
 * `test.concurrent` invocation handles one Nexus file.
 */
const require_ = createRequire(import.meta.url);
const VORTEX_API_MOCK = require_.resolve("@vortex/extension-test-mocks");

// GDL-generated extensions import the runtime via the `@gdl/runtime` webpack
// alias. The harness loads the generated TS (not the bundle), so map the same
// specifier to the submodule's runtime source.
const here = path.dirname(fileURLToPath(import.meta.url));
const GDL_RUNTIME = path.resolve(here, "../../game-description-language/src/runtime/index.ts");

// Each fixture makes at least two HTTP calls (listModFiles + manifest); a slow
// Nexus response can easily exceed vitest's 5s default.
const FIXTURE_TEST_TIMEOUT_MS = 30_000;

// One authenticated Nexus call per fixture; staying just under the SDK's
// 25-req/s burst keeps headroom for the unmetered CDN manifest fetches.
const FIXTURE_MAX_CONCURRENCY = 24;

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@nexusmods\/vortex-api$/, replacement: VORTEX_API_MOCK },
      { find: /^@gdl\/runtime$/, replacement: GDL_RUNTIME },
    ],
  },
  test: {
    environment: "node",
    include: ["src/test-entry.test.ts"],
    testTimeout: FIXTURE_TEST_TIMEOUT_MS,
    maxConcurrency: FIXTURE_MAX_CONCURRENCY,
  },
});
