import * as path from "node:path";
import { defineConfig } from "vitest/config";

const mock = (name: string) =>
  path.resolve(import.meta.dirname, `__mocks__/${name}.ts`);

export default defineConfig({
  resolve: {
    alias: {
      "original-fs": "fs",
      "vortex-api": mock("vortex-api"),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./test-setup.ts"],
    include: ["src/**/*.test.ts"],
  },
});
