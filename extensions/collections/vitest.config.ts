import * as path from "node:path";
import { defineConfig } from "vitest/config";

const mock = (name: string) =>
  path.resolve(import.meta.dirname, `__mocks__/${name}.ts`);

export default defineConfig({
  resolve: {
    alias: {
      "vortex-api": mock("vortex-api"),
      vortexmt: mock("vortexmt"),
      turbowalk: mock("turbowalk"),
      "modmeta-db": mock("modmeta-db"),
      "bsdiff-node": mock("bsdiff-node"),
      "node-7z": mock("node-7z"),
      tmp: mock("tmp"),
      "@nexusmods/nexus-api": mock("nexus-api"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
