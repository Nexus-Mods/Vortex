import { defineConfig, type UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
  entry: "./src/index.ts",
  format: ["esm", "commonjs"],
  sourcemap: true,
  dts: {
    sourcemap: true,
  },
  exports: {
    devExports: "development",
  },
  platform: "neutral",
});

export default config;
