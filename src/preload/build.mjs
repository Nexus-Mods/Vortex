import * as path from "node:path";
import { rolldown } from "rolldown";

import { createConfig, mainOutputDirectory } from "../../rolldown.base.mjs";

const INPUT = path.resolve(import.meta.dirname, "src", "index.ts");
const OUTPUT = path.join(mainOutputDirectory, "preload.js");

const config = createConfig(INPUT, OUTPUT, "cjs", [], ["electron"]);

const bundle = await rolldown(config);
await bundle.write(config.output);
