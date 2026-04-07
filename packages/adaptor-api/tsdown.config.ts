import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/lib.ts",
    plugin: "./src/plugin.ts",
    "contracts/ping": "./src/contracts/ping.ts",
  },
  format: ["esm", "commonjs"],
  dts: {
    sourcemap: true,
  },
  exports: {
    devExports: "development",
  },
  platform: "neutral",
});
