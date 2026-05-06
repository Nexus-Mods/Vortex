import { vortexAdaptorPlugin } from "@nexusmods/adaptor-api/plugin";
import { rolldown, defineConfig } from "rolldown";

const config = defineConfig({
  input: "./src/index.ts",
  platform: "neutral",
  external: (id) =>
    id.startsWith("@nexusmods/adaptor-api") || id.startsWith("@nexusmods/adaptor-api/fs"),
  plugins: [
    vortexAdaptorPlugin({
      fs: "vortex:host/filesystem",
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
