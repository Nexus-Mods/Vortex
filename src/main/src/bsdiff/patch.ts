/**
 * File-level bsdiff operations: read the inputs, run the wasm op, write the
 * output. Kept separate from the worker entry so they can be exercised directly
 * in a test without spawning a worker.
 */

import * as fs from "node:fs/promises";

import { applyPatch, createPatch, type BsdiffWasmExports } from "./wasm";

/** Create a BSDIFF40 patch file from oldPath and newPath. */
export async function createPatchFile(
  wasm: BsdiffWasmExports,
  oldPath: string,
  newPath: string,
  patchPath: string,
): Promise<void> {
  const [oldBuf, newBuf] = await Promise.all([fs.readFile(oldPath), fs.readFile(newPath)]);
  await fs.writeFile(patchPath, createPatch(wasm, oldBuf, newBuf));
}

/** Apply a BSDIFF40 patch file to oldPath, writing the result to outPath. */
export async function applyPatchFile(
  wasm: BsdiffWasmExports,
  oldPath: string,
  patchPath: string,
  outPath: string,
): Promise<void> {
  const [oldBuf, patchBuf] = await Promise.all([fs.readFile(oldPath), fs.readFile(patchPath)]);
  await fs.writeFile(outPath, applyPatch(wasm, oldBuf, patchBuf));
}
