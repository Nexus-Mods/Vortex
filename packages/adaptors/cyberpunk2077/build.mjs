import { vortexAdaptorPlugin } from "@vortex/adaptor-api/plugin";
import { rolldown, defineConfig } from "rolldown";

const config = defineConfig({
  input: "./src/index.ts",
  platform: "neutral",
  external: (id) =>
    id.startsWith("@vortex/adaptor-api") || id.startsWith("@vortex/fs"),
  plugins: [
    vortexAdaptorPlugin({}),
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
