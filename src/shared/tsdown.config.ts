import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    "*": "./src/api/*.ts",
  },
  format: ["esm", "commonjs"],
  sourcemap: true,
  dts: {
    sourcemap: true,
  },
  exports: true,
  platform: "neutral",
});
