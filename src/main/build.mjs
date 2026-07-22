import * as fs from "node:fs/promises";
import { createRequire } from "node:module";
import * as path from "node:path";

import { rolldown } from "rolldown";

import { createConfig, mainOutputDirectory } from "../../rolldown.base.mjs";

const INPUT = path.resolve(import.meta.dirname, "src", "main.ts");
const OUTPUT = path.join(mainOutputDirectory, "main.cjs");

const config = createConfig(INPUT, OUTPUT, "cjs", [], (id) => {
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

// Each worker_thread bundles to a standalone CJS entry next to main.cjs, spawned
// by its host. They share one external policy: bundle relative/local sources,
// leave node built-ins and dependencies external.
async function bundleWorker(inputRelPath, outputName) {
  const config = createConfig(
    path.resolve(import.meta.dirname, inputRelPath),
    path.join(mainOutputDirectory, outputName),
    "cjs",
    [],
    (id) => {
      if (id.startsWith(".")) return false;
      if (path.isAbsolute(id)) return false;

      return true;
    },
  );
  const bundle = await rolldown(config);
  await bundle.write(config.output);
}

// bsdiff patch worker (src/main/src/bsdiff/host.ts). hdiff.wasm is copied
// alongside below so the worker reads it by a path relative to itself.
await bundleWorker("./src/bsdiff/worker.ts", "bsdiff-worker.cjs");

// hash worker (src/main/src/hash/host.ts). Uses node's crypto, so there is
// nothing extra to copy alongside it.
await bundleWorker("./src/hash/worker.ts", "hash-worker.cjs");

const require = createRequire(import.meta.url);
const wasmPackageDir = path.resolve(require.resolve("@hot-updater/bsdiff"), "..", "..");
await fs.copyFile(
  path.join(wasmPackageDir, "assets", "hdiff.wasm"),
  path.join(mainOutputDirectory, "hdiff.wasm"),
);
