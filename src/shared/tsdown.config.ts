import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    "*": "./src/api/*.ts",
  },
  format: ["esm", "commonjs"],
  dts: {
    sourcemap: true,
  },
  external: [/^@opentelemetry\//, "bluebird"],
  exports: true,
  platform: "neutral",
});
