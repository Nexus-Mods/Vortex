import { rolldown, defineConfig } from "rolldown";
import { vortexAdaptorPlugin } from "@nexusmods/adaptor-api/plugin";

const config = defineConfig({
  input: "./src/index.ts",
  platform: "neutral",
  external: (id) => id.startsWith("@nexusmods/adaptor-api"),
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
