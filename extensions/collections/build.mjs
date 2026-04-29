import * as path from "node:path";
import { createConfig, bundle } from "../../scripts/extensions-rolldown.mjs";

const extensionPath = path.resolve(import.meta.dirname);

// Main extension bundle
const entryPoint = path.resolve(extensionPath, "src", "index.ts");
const output = path.resolve(extensionPath, "dist", "index.cjs");
const config = createConfig(entryPoint, output);
await bundle(config);

// bsdiff worker — runs in a separate thread, needs its own bundle
const workerEntry = path.resolve(
  extensionPath,
  "src",
  "util",
  "bsdiffWorker.ts",
);
const workerOutput = path.resolve(extensionPath, "dist", "bsdiffWorker.cjs");
const workerConfig = createConfig(workerEntry, workerOutput);
await bundle(workerConfig);
