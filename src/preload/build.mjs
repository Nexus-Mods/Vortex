import * as path from "node:path";

import { rolldown } from "rolldown";

import { createConfig, mainOutputDirectory } from "../../rolldown.base.mjs";

const INPUT = path.resolve(import.meta.dirname, "src", "index.ts");
const OUTPUT = path.join(mainOutputDirectory, "preload.cjs");

const config = createConfig(INPUT, OUTPUT, "cjs", [], (id) => {
  if (id.startsWith(".")) return false;
  if (path.isAbsolute(id)) return false;

  // TODO: inline @vortex/shared when enabling contextIsolation
  return id === "electron" || id.startsWith("@vortex/shared");
});

const bundle = await rolldown(config);
await bundle.write(config.output);
