import * as path from "node:path";

import { rolldown, defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

const config = defineConfig({
  input: "lib/api.d.ts",
  plugins: [
    dts({
      emitDtsOnly: true,
      tsconfig: "tsconfig.api.json",
      dtsInput: true,
    }),
  ],
  output: {
    dir: path.resolve(import.meta.dirname, "..", "..", "packages", "vortex-api", "lib"),
  },
  external: (id) => {
    if (id.startsWith(".")) return false;
    if (path.isAbsolute(id)) return false;
    if (id.startsWith("@vortex/shared")) return false;

    return true;
  },
});

const build = await rolldown(config);
await build.write(config.output);
