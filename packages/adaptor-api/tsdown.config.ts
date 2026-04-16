import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/lib.ts",
    plugin: "./src/plugin.ts",
    "contracts/*": ["./src/contracts/*.ts", "!./src/contracts/*.test.ts"],
    "stores/lib": "./src/stores/lib.ts",
  },
  format: ["esm", "cjs"],
  dts: {
    sourcemap: true,
  },
  exports: {
    devExports: "development",
  },
  platform: "neutral",
});
