import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
  },
  format: ["esm", "cjs"],
  dts: {
    sourcemap: true,
  },
  exports: true,
  platform: "neutral",
  deps: {
    onlyBundle: ["openapi-typescript-helpers", "openapi-fetch"],
  },
});
