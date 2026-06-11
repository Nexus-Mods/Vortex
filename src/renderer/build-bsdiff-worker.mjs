import * as fs from "node:fs/promises";
// Bundles the collections bsdiff DOM worker to a standalone CommonJS script
// emitted next to the renderer bundle (src/main/build), where bsdiff.ts loads
// it by file URL at runtime. The renderer is a CommonJS package, so webpack's
// `new Worker(new URL(..., import.meta.url))` auto-bundling is unavailable
// (import.meta is disallowed in CJS); this mirrors the standalone worker bundle
// the collections extension produced before it was folded into the renderer.
import { createRequire } from "node:module";
import * as path from "node:path";

import { createConfig, bundle } from "../../scripts/extensions-rolldown.mjs";

const require = createRequire(import.meta.url);
const here = path.resolve(import.meta.dirname);
const buildDir = path.resolve(here, "../main/build");

const entry = path.resolve(here, "src/extensions/collections/util/bsdiffWorker.dom.ts");
const output = path.join(buildDir, "bsdiffWorker.dom.cjs");

await bundle(createConfig(entry, output));
console.log(`built ${path.relative(process.cwd(), output)}`);

// Copy hdiff.wasm next to the renderer bundle so bsdiff.ts can load it via
// `path.join(__dirname, "hdiff.wasm")` at runtime (require.resolve is unreliable
// inside the webpack bundle).
const wasmPkgDir = path.resolve(require.resolve("@hot-updater/bsdiff"), "..", "..");
const wasmSrc = path.join(wasmPkgDir, "assets", "hdiff.wasm");
const wasmDest = path.join(buildDir, "hdiff.wasm");
await fs.copyFile(wasmSrc, wasmDest);
console.log(`copied ${path.relative(process.cwd(), wasmDest)}`);
