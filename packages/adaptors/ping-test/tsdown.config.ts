import { defineConfig } from "tsdown";
import { vortexAdaptorPlugin } from "@vortex/adaptor-api/plugin";

export default defineConfig({
  entry: "./src/index.ts",
  format: ["esm", "commonjs"],
  dts: {
    sourcemap: true,
  },
  exports: true,
  platform: "neutral",
  plugins: [
    vortexAdaptorPlugin({
      ping: "vortex:host/ping",
    }),
  ],
});
