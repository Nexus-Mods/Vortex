/**
 * File-level bsdiff operations: read the inputs, run the wasm op, write the
 * output. Kept separate from the worker entry so they can be exercised directly
 * in a test without spawning a worker.
 */

import * as fs from "node:fs/promises";

import { createLinearPatchFile } from "./linear";
import { applyPatch, createPatch, type BsdiffWasmExports } from "./wasm";

// The wasm bsdiff's suffix sort needs about 14 bytes of wasm memory per input byte, and
// wasm memory stops at 4 GiB, so it runs out of memory on files of a few hundred MB. The
// worker keeps one wasm instance whose memory never shrinks, so this stays well below that.
// Larger files get a linear patch instead.
export const MAX_SUFFIX_SORT_SIZE = 128 * 1024 * 1024;

/** Create a BSDIFF40 patch file from oldPath and newPath. */
export async function createPatchFile(
  wasm: BsdiffWasmExports,
  oldPath: string,
  newPath: string,
  patchPath: string,
  maxSuffixSortSize = MAX_SUFFIX_SORT_SIZE,
): Promise<void> {
  const [oldStat, newStat] = await Promise.all([fs.stat(oldPath), fs.stat(newPath)]);
  if (Math.max(oldStat.size, newStat.size) > maxSuffixSortSize) {
    return createLinearPatchFile(wasm, oldPath, newPath, patchPath);
  }
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
