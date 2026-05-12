import { createRequire } from "node:module";

import { defineConfig } from "vitest/config";

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
