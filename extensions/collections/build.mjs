import * as path from "node:path";

import { createConfig, bundle } from "../../scripts/extensions-rolldown.mjs";

const extensionPath = path.resolve(import.meta.dirname);

// Main extension bundle
const entryPoint = path.resolve(extensionPath, "src", "index.ts");
const output = path.resolve(extensionPath, "dist", "index.cjs");
const config = createConfig(entryPoint, output);
await bundle(config);

// bsdiff workers — run in a separate thread, need their own bundles.
// The .dom variant is what production uses (DOM Worker in the renderer);
// the worker_threads variant is kept for vitest, which runs in Node.
const workers = [
  { entry: "bsdiffWorker.ts", output: "bsdiffWorker.cjs" },
  { entry: "bsdiffWorker.dom.ts", output: "bsdiffWorker.dom.cjs" },
];
for (const w of workers) {
  const workerEntry = path.resolve(extensionPath, "src", "util", w.entry);
  const workerOutput = path.resolve(extensionPath, "dist", w.output);
  const workerConfig = createConfig(workerEntry, workerOutput);
  await bundle(workerConfig);
}
