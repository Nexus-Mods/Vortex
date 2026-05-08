import * as path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "vortex-api": path.resolve(import.meta.dirname, "__mocks__/vortex-api.ts"),
      "@electron/remote": path.resolve(import.meta.dirname, "__mocks__/electron-remote.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/index.ts"],
    },
  },
});
