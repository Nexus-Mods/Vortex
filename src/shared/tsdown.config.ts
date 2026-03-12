import { defineConfig, type UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
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

export default config;
