import * as fs from "node:fs/promises";
import { createRequire } from "node:module";
import * as path from "node:path";

import { rolldown } from "rolldown";

import { createConfig, mainOutputDirectory } from "../../rolldown.base.mjs";

const INPUT = path.resolve(import.meta.dirname, "src", "main.ts");
const OUTPUT = path.join(mainOutputDirectory, "main.cjs");

const config = createConfig(INPUT, OUTPUT, "cjs", [], (id) => {
  if (id.startsWith("@vortex/shared")) return false;

  if (id.startsWith(".")) return false;
  if (path.isAbsolute(id)) return false;

  return true;
});

const bundle = await rolldown(config);
await bundle.write(config.output);

const BOOTSTRAP_INPUT = path.resolve(import.meta.dirname, "./src/node-adaptor-host/bootstrap.ts");
const BOOTSTRAP_OUTPUT = path.join(mainOutputDirectory, "bootstrap.mjs");

const bootstrapConfig = createConfig(BOOTSTRAP_INPUT, BOOTSTRAP_OUTPUT, "esm", [], (id) =>
  id.startsWith("@nexusmods/adaptor-api"),
);

const bootstrapBundle = await rolldown(bootstrapConfig);
await bootstrapBundle.write(bootstrapConfig.output);

// bsdiff patch worker: bundled as a standalone CJS entry next to main.cjs and
// spawned as a worker_thread by src/main/src/bsdiff/host.ts. hdiff.wasm is
// copied alongside so the worker reads it by a path relative to itself.
const BSDIFF_WORKER_INPUT = path.resolve(import.meta.dirname, "./src/bsdiff/worker.ts");
const BSDIFF_WORKER_OUTPUT = path.join(mainOutputDirectory, "bsdiff-worker.cjs");

const bsdiffConfig = createConfig(BSDIFF_WORKER_INPUT, BSDIFF_WORKER_OUTPUT, "cjs", [], (id) => {
  if (id.startsWith("@vortex/shared")) return false;

  if (id.startsWith(".")) return false;
  if (path.isAbsolute(id)) return false;

  return true;
});

const bsdiffBundle = await rolldown(bsdiffConfig);
await bsdiffBundle.write(bsdiffConfig.output);

const require = createRequire(import.meta.url);
const wasmPackageDir = path.resolve(require.resolve("@hot-updater/bsdiff"), "..", "..");
await fs.copyFile(
  path.join(wasmPackageDir, "assets", "hdiff.wasm"),
  path.join(mainOutputDirectory, "hdiff.wasm"),
);
