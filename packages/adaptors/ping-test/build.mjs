import { rolldown, defineConfig } from "rolldown";
import { vortexAdaptorPlugin } from "@vortex/adaptor-api/plugin";

const config = defineConfig({
  input: "./src/index.ts",
  platform: "neutral",
  external: (id) => id.startsWith("@vortex/adaptor-api"),
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
