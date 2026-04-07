import { rolldown, defineConfig } from "rolldown";
import { vortexAdaptorPlugin } from "@vortex/adaptor-api/plugin";

const config = defineConfig({
  input: "./src/index.ts",
  platform: "neutral",
  plugins: [
    vortexAdaptorPlugin({
      ping: "vortex:host/ping",
    }),
  ],
});

const bundle = await rolldown(config);

await bundle.write({
  dir: "dist",
  format: "esm",
  cleanDir: true,
  entryFileNames: "[name].mjs",
  sourcemap: true,
});

await bundle.write({
  dir: "dist",
  format: "cjs",
  entryFileNames: "[name].cjs",
  sourcemap: true,
});
