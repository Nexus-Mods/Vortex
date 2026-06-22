import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
  },
  format: ["esm", "commonjs"],
  dts: {
    sourcemap: true,
  },
  exports: true,
  platform: "neutral",
});
