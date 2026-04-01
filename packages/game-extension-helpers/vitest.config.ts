import * as path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@vortex/paths": path.resolve(
        import.meta.dirname,
        "../paths/src/index.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
