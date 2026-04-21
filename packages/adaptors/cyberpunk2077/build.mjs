import { vortexAdaptorPlugin } from "@vortex/adaptor-api/plugin";
import { rolldown, defineConfig } from "rolldown";

const config = defineConfig({
  input: "./src/index.ts",
  platform: "neutral",
  // Only the two host-provided root modules are externalized. Subpath
  // imports like `@vortex/adaptor-api/contracts/game-installer` are
  // bundled in, because the adaptor sandbox only exposes the root
  // `@vortex/adaptor-api` and `@vortex/fs` specifiers at runtime.
  external: (id) => id === "@vortex/adaptor-api" || id === "@vortex/fs",
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
