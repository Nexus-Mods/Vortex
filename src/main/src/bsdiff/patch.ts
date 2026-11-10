/**
 * File-level bsdiff operations, streamed by hdiffz so memory stays small
 * whatever the file sizes. Kept separate from the worker entry so they can be
 * exercised directly in a test without spawning a worker.
 */

import { runHdiffz } from "./wasm";

// bsdiff 4 output, matching the old file in 64-byte blocks as both files
// stream. hdiffz then applies the patch once to check it reproduces newPath.
const CREATE_OPTIONS = ["-s", "-BSD", "-f"];
// applies any bsdiff 4 patch, streaming through an 8 MiB cache
const APPLY_OPTIONS = ["--patch", "-s-8m", "-f"];

/** Create a BSDIFF40 patch file from oldPath and newPath. Blocks until done. */
export function createPatchFile(
  wasmModule: WebAssembly.Module,
  oldPath: string,
  newPath: string,
  patchPath: string,
): void {
  runHdiffz(wasmModule, CREATE_OPTIONS, [oldPath, newPath, patchPath]);
}

/** Apply a BSDIFF40 patch file to oldPath, writing the result to outPath. Blocks until done. */
export function applyPatchFile(
  wasmModule: WebAssembly.Module,
  oldPath: string,
  patchPath: string,
  outPath: string,
): void {
  runHdiffz(wasmModule, APPLY_OPTIONS, [oldPath, patchPath, outPath]);
}
