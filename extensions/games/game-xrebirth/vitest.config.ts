import { createRequire } from "node:module";

import { defineConfig } from "vitest/config";

// Resolve through Node's package resolution so the alias survives any future
// move of the mock package. Regex `find` ensures `vortex-api` is the only
// specifier rewritten (vitest's default string alias is prefix-matched).
const require_ = createRequire(import.meta.url);
const VORTEX_API_MOCK = require_.resolve("@vortex/extension-test-mocks");

export default defineConfig({
  resolve: {
    alias: [{ find: /^vortex-api$/, replacement: VORTEX_API_MOCK }],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
