import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
  },
  format: ["esm", "cjs"],
  platform: "node",
  tsconfig: "./tsconfig.json",
  dts: { sourcemap: true },
  exports: {
    devExports: "development",
  },
  outputOptions: {
    exports: "named",
  },
});
