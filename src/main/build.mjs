import * as path from "node:path";
import { rolldown } from "rolldown";

import { createConfig, mainOutputDirectory } from "../../rolldown.base.mjs";

const INPUT = path.resolve(import.meta.dirname, "src", "main.ts");
const OUTPUT = path.join(mainOutputDirectory, "main.mjs");

const config = createConfig(INPUT, OUTPUT, "esm", [], (id) => {
  if (id.startsWith("@vortex/shared")) return false;

  if (id.startsWith(".")) return false;
  if (path.isAbsolute(id)) return false;

  return true;
});

const bundle = await rolldown(config);
await bundle.write(config.output);
