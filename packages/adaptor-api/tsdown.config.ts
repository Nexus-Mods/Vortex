import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/lib.ts",
    plugin: "./src/plugin.ts",
    "fs/index": "./src/fs/lib.ts",
    "contracts/*": ["./src/contracts/*.ts", "!./src/contracts/*.test.ts"],
  },
  format: ["esm", "cjs"],
  platform: "neutral",
  tsconfig: "./tsconfig.json",
  dts: { sourcemap: true },
  exports: {
    devExports: "development",
  },
});
