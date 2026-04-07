import * as path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@vortex/adaptor-api/interfaces": path.resolve(
        import.meta.dirname,
        "../adaptor-api/src/interfaces.ts",
      ),
      "@vortex/adaptor-api/branded": path.resolve(
        import.meta.dirname,
        "../adaptor-api/src/types/branded.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    pool: "forks",
  },
});
