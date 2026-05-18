/**
 * BSDIFF40-compatible binary diff and patch using WASM.
 *
 * The WASM computation runs in a worker thread to avoid blocking the
 * Electron main/renderer thread. A single long-lived worker is spawned
 * on first use and reused for all subsequent calls.
 */

import * as fs from "fs";
import * as path from "path";
import { Worker } from "worker_threads";

import type { BsdiffRequest, BsdiffResponse } from "./bsdiffWorker";

// --- Path resolution ---

function getWasmPath(): string {
  const bundledPath = path.join(__dirname, "hdiff.wasm");
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }
  const nodeEntry = require.resolve("@hot-updater/bsdiff");
  const pkgDir = path.resolve(nodeEntry, "..", "..");
  return path.join(pkgDir, "assets", "hdiff.wasm");
}

function getWorkerPath(): string {
  const bundledPath = path.join(__dirname, "bsdiffWorker.cjs");
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }
  return path.join(__dirname, "bsdiffWorker.ts");
}

// --- Worker management ---

let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (buf: Uint8Array) => void; reject: (err: Error) => void }
>();

function getWorker(): Worker {
  if (worker !== undefined) return worker;

  const workerPath = getWorkerPath();
  const isTsSource = workerPath.endsWith(".ts");

  worker = new Worker(workerPath, {
    workerData: { wasmPath: getWasmPath() },
    // When running the .ts source directly (tests), use Node's built-in
    // TypeScript stripping (available in Node >= 22.6).
    ...(isTsSource ? { execArgv: ["--experimental-strip-types"] } : {}),
  });

  worker.on("message", (msg: BsdiffResponse) => {
    const entry = pending.get(msg.id);
    if (entry === undefined) return;
    pending.delete(msg.id);
    if (msg.error !== undefined) {
      entry.reject(new Error(msg.error));
    } else {
      entry.resolve(msg.result!);
    }
  });

  worker.on("error", (err) => {
    // Reject all pending requests
    for (const entry of pending.values()) {
      entry.reject(err);
    }
    pending.clear();
    worker = undefined;
  });

  // Don't keep the process alive just for the worker
  worker.unref();

  return worker;
}

function postToWorker(
  op: "create_patch" | "apply_patch",
  left: Uint8Array,
  right: Uint8Array,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, op, left, right } satisfies BsdiffRequest, [
      left.buffer as ArrayBuffer,
      right.buffer as ArrayBuffer,
    ]);
  });
}

// --- Public API ---

/**
 * Create a BSDIFF40 patch from two buffers.
 * Runs in a worker thread — does not block the caller.
 */
export async function createPatch(oldBuf: Uint8Array, newBuf: Uint8Array): Promise<Uint8Array> {
  return postToWorker("create_patch", new Uint8Array(oldBuf), new Uint8Array(newBuf));
}

/**
 * Apply a BSDIFF40 patch to a buffer.
 * Runs in a worker thread — does not block the caller.
 */
export async function applyPatch(oldBuf: Uint8Array, patchBuf: Uint8Array): Promise<Uint8Array> {
  return postToWorker("apply_patch", new Uint8Array(oldBuf), new Uint8Array(patchBuf));
}

/**
 * Create a BSDIFF40 patch file from two files.
 */
export async function diffFiles(
  oldPath: string,
  newPath: string,
  patchPath: string,
): Promise<void> {
  const oldBuf = await fs.promises.readFile(oldPath);
  const newBuf = await fs.promises.readFile(newPath);
  const patch = await createPatch(oldBuf, newBuf);
  await fs.promises.writeFile(patchPath, patch);
}

/**
 * Apply a BSDIFF40 patch file.
 */
export async function patchFiles(
  oldPath: string,
  outputPath: string,
  patchPath: string,
): Promise<void> {
  const oldBuf = await fs.promises.readFile(oldPath);
  const patchBuf = await fs.promises.readFile(patchPath);
  const result = await applyPatch(oldBuf, patchBuf);
  await fs.promises.writeFile(outputPath, result);
}
