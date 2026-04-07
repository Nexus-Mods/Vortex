import { defineConfig } from "tsdown";
import { vortexAdaptorPlugin } from "@vortex/adaptor-api/plugin";

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
  deps: {
    neverBundle: [/^@vortex\/adaptor-api/],
  },
  plugins: [
    vortexAdaptorPlugin({
      ping: "vortex:host/ping",
    }),
  ],
});
