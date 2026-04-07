import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    interfaces: "./src/interfaces.ts",
    branded: "./src/types/branded.ts",
    builder: "./src/builder.ts",
    plugin: "./src/plugin.ts",
    "runtime-container": "./src/runtime-container.ts",
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
