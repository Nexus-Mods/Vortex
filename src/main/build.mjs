import * as path from "node:path";
import { rolldown } from "rolldown";

import { createConfig, mainOutputDirectory } from "../../rolldown.base.mjs";

const INPUT = path.resolve(import.meta.dirname, "src", "main.ts");
const OUTPUT = path.join(mainOutputDirectory, "main.cjs");

const SHIM_PATH = path.resolve(
  import.meta.dirname,
  "../../src/renderer/src/util/winapi-shim.ts",
);

const linuxAlias =
  process.platform === "linux"
    ? { "winapi-bindings": SHIM_PATH }
    : undefined;

const config = createConfig(INPUT, OUTPUT, "cjs", [], (id) => {
  if (id.startsWith("@vortex/shared")) return false;

  if (id.startsWith(".")) return false;
  if (path.isAbsolute(id)) return false;

  return true;
}, linuxAlias);

const bundle = await rolldown(config);
await bundle.write(config.output);

const BOOTSTRAP_INPUT = path.resolve(
  import.meta.dirname,
  "./src/node-adaptor-host/bootstrap.ts",
);
const BOOTSTRAP_OUTPUT = path.join(mainOutputDirectory, "bootstrap.mjs");

const bootstrapConfig = createConfig(
  BOOTSTRAP_INPUT,
  BOOTSTRAP_OUTPUT,
  "esm",
  [],
  (id) => id.startsWith("@vortex/adaptor-api"),
);

const bootstrapBundle = await rolldown(bootstrapConfig);
await bootstrapBundle.write(bootstrapConfig.output);
