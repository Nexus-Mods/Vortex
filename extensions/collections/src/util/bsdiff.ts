/**
 * BSDIFF40-compatible binary diff and patch using WASM.
 *
 * Production (Electron renderer) runs the WASM in a DOM Worker —
 * Electron's renderer does not support `node:worker_threads`, so the
 * Web Worker is the only viable off-thread option. Tests (vitest in
 * node environment) fall back to `worker_threads`. The WASM logic
 * itself is shared via bsdiffWasm.ts.
 */

import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";

import type { BsdiffRequest, BsdiffResponse } from "./bsdiffWasm";

const IS_RENDERER = typeof Worker !== "undefined";

// --- Path resolution ---

function getWasmPath(): string {
  const bundled = path.join(__dirname, "hdiff.wasm");
  if (fs.existsSync(bundled)) return bundled;
  const nodeEntry = require.resolve("@hot-updater/bsdiff");
  return path.join(path.resolve(nodeEntry, "..", ".."), "assets", "hdiff.wasm");
}

function resolveWorkerScript(stem: string): { path: string; isTsSource: boolean } {
  const bundled = path.join(__dirname, `${stem}.cjs`);
  if (fs.existsSync(bundled)) return { path: bundled, isTsSource: false };
  return { path: path.join(__dirname, `${stem}.ts`), isTsSource: true };
}

// --- Worker handle abstraction ---

interface WorkerHandle {
  post(msg: BsdiffRequest, transfer: ArrayBuffer[]): void;
  onMessage(cb: (msg: BsdiffResponse) => void): void;
  onError(cb: (err: Error) => void): void;
}

function spawnDomWorker(): WorkerHandle {
  const { path: scriptPath } = resolveWorkerScript("bsdiffWorker.dom");
  const url = `${pathToFileURL(scriptPath).href}?wasmPath=${encodeURIComponent(getWasmPath())}`;
  const w = new Worker(url);
  return {
    post: (msg, transfer) => w.postMessage(msg, transfer),
    onMessage: (cb) => w.addEventListener("message", (e) => cb(e.data as BsdiffResponse)),
    onError: (cb) =>
      w.addEventListener("error", (e: ErrorEvent) =>
        cb(e.error instanceof Error ? e.error : new Error(e.message)),
      ),
  };
}

function spawnNodeWorker(): WorkerHandle {
  const { path: scriptPath, isTsSource } = resolveWorkerScript("bsdiffWorker");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Worker: NodeWorker } = require("worker_threads") as typeof import("worker_threads");
  const w = new NodeWorker(scriptPath, {
    workerData: { wasmPath: getWasmPath() },
    // When running the .ts source directly (tests), use Node's built-in
    // TypeScript stripping (available in Node >= 22.6).
    ...(isTsSource ? { execArgv: ["--experimental-strip-types"] } : {}),
  });
  w.unref();
  return {
    post: (msg, transfer) => w.postMessage(msg, transfer),
    onMessage: (cb) => w.on("message", cb),
    onError: (cb) => w.on("error", cb),
  };
}

// --- Worker management ---

let worker: WorkerHandle | undefined;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (buf: Uint8Array) => void; reject: (err: Error) => void }
>();

function getWorker(): WorkerHandle {
  if (worker !== undefined) return worker;

  worker = IS_RENDERER ? spawnDomWorker() : spawnNodeWorker();

  worker.onMessage((msg) => {
    const entry = pending.get(msg.id);
    if (entry === undefined) return;
    pending.delete(msg.id);
    if (msg.error !== undefined) {
      entry.reject(new Error(msg.error));
    } else {
      entry.resolve(msg.result!);
    }
  });

  worker.onError((err) => {
    for (const entry of pending.values()) entry.reject(err);
    pending.clear();
    worker = undefined;
  });

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
    getWorker().post({ id, op, left, right }, [
      left.buffer as ArrayBuffer,
      right.buffer as ArrayBuffer,
    ]);
  });
}

// --- Public API ---

/** Create a BSDIFF40 patch from two buffers. Runs off-thread. */
export async function createPatch(oldBuf: Uint8Array, newBuf: Uint8Array): Promise<Uint8Array> {
  return postToWorker("create_patch", new Uint8Array(oldBuf), new Uint8Array(newBuf));
}

/** Apply a BSDIFF40 patch to a buffer. Runs off-thread. */
export async function applyPatch(oldBuf: Uint8Array, patchBuf: Uint8Array): Promise<Uint8Array> {
  return postToWorker("apply_patch", new Uint8Array(oldBuf), new Uint8Array(patchBuf));
}

/** Create a BSDIFF40 patch file from two files. */
export async function diffFiles(
  oldPath: string,
  newPath: string,
  patchPath: string,
): Promise<void> {
  const oldBuf = await fs.promises.readFile(oldPath);
  const newBuf = await fs.promises.readFile(newPath);
  await fs.promises.writeFile(patchPath, await createPatch(oldBuf, newBuf));
}

/** Apply a BSDIFF40 patch file. */
export async function patchFiles(
  oldPath: string,
  outputPath: string,
  patchPath: string,
): Promise<void> {
  const oldBuf = await fs.promises.readFile(oldPath);
  const patchBuf = await fs.promises.readFile(patchPath);
  await fs.promises.writeFile(outputPath, await applyPatch(oldBuf, patchBuf));
}
