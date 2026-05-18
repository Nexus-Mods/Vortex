import * as path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "vortex-api": path.resolve(import.meta.dirname, "__mocks__/vortex-api.ts"),
      "modmeta-db": path.resolve(import.meta.dirname, "__mocks__/modmeta-db.ts"),
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
  },
});
