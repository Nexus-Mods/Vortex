import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/lib.ts",
  },
  format: ["esm", "cjs"],
  platform: "neutral",
  tsconfig: "./tsconfig.json",
  dts: { sourcemap: true },
  exports: {
    devExports: "development",
  },
});
