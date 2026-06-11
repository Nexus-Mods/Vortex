/**
 * BSDIFF40-compatible binary diff and patch using WASM.
 *
 * In the Electron renderer (the only place collections runs) the WASM runs
 * off-thread in a bundler-emitted DOM Worker — Electron's renderer does not
 * support `node:worker_threads`, so a Web Worker is the only viable off-thread
 * option. In a plain Node context (e.g. vitest, where no DOM `Worker` global
 * exists) we fall back to running the WASM inline on the calling thread, behind
 * the same async API. The WASM logic itself is shared via bsdiffWasm.ts.
 */

import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";

import { getErrorMessageOrDefault } from "@vortex/shared";

import type { BsdiffInit, BsdiffRequest, BsdiffResponse } from "./bsdiffWasm";
import { loadWasm, processRequest } from "./bsdiffWasm";

const IS_RENDERER = typeof Worker !== "undefined";

// --- WASM bytes ---

function getWasmPath(): string {
  // Production (renderer): hdiff.wasm is copied next to the renderer bundle by
  // src/renderer/build-bsdiff-worker.mjs. require.resolve is unreliable inside
  // the webpack bundle (it resolves relative to the bundle, not the package),
  // so prefer the bundled copy here.
  const bundled = path.join(__dirname, "hdiff.wasm");
  if (fs.existsSync(bundled)) {
    return bundled;
  }
  // Tests / Node: resolve straight from the installed @hot-updater/bsdiff package.
  const nodeEntry = require.resolve("@hot-updater/bsdiff");
  return path.join(path.resolve(nodeEntry, "..", ".."), "assets", "hdiff.wasm");
}

let wasmBytesCache: Uint8Array | undefined;
function getWasmBytes(): Uint8Array {
  if (wasmBytesCache === undefined) {
    wasmBytesCache = fs.readFileSync(getWasmPath());
  }
  return wasmBytesCache;
}

function toErrorResponse(id: number, err: unknown): BsdiffResponse {
  return { id, error: getErrorMessageOrDefault(err) };
}

// --- Worker handle abstraction ---

interface WorkerHandle {
  post(msg: BsdiffRequest, transfer: ArrayBuffer[]): void;
  onMessage(cb: (msg: BsdiffResponse) => void): void;
  onError(cb: (err: Error) => void): void;
}

function spawnDomWorker(): WorkerHandle {
  // The DOM worker is bundled to a standalone script next to the renderer bundle
  // by src/renderer/build-bsdiff-worker.mjs (the renderer is a CommonJS package,
  // so webpack's `new Worker(new URL(..., import.meta.url))` auto-bundling is not
  // available — import.meta is disallowed in CJS). Load it by file URL.
  const scriptPath = path.join(__dirname, "bsdiffWorker.dom.cjs");
  const w = new Worker(pathToFileURL(scriptPath).href);
  // Hand the worker the WASM bytes once, up front; message order is preserved
  // so this always arrives before any op request.
  w.postMessage({ init: true, wasm: getWasmBytes() } satisfies BsdiffInit);
  return {
    post: (msg, transfer) => w.postMessage(msg, transfer),
    onMessage: (cb) => w.addEventListener("message", (e) => cb(e.data as BsdiffResponse)),
    onError: (cb) =>
      w.addEventListener("error", (e: ErrorEvent) =>
        cb(e.error instanceof Error ? e.error : new Error(e.message)),
      ),
  };
}

// Fallback for non-renderer contexts (vitest/Node, where no DOM `Worker` global
// exists): run the WASM synchronously on the calling thread behind the same
// async WorkerHandle API. Every failure — WASM load, non-OK op status, or an
// unexpected throw — is turned into an error response so the shared onMessage
// handler rejects the corresponding op rather than dropping it.
function makeInlineWorker(): WorkerHandle {
  let wasm: ReturnType<typeof loadWasm> | undefined;
  let handler: ((msg: BsdiffResponse) => void) | undefined;
  return {
    post: (msg) => {
      let response: BsdiffResponse;
      try {
        if (wasm === undefined) {
          wasm = loadWasm(getWasmBytes());
        }
        response = processRequest(wasm, msg);
      } catch (err) {
        response = toErrorResponse(msg.id, err);
      }
      queueMicrotask(() => handler?.(response));
    },
    onMessage: (cb) => {
      handler = cb;
    },
    // Inline execution has no separate worker thread that can die, so there is
    // no asynchronous error channel: every failure is surfaced through the
    // response's `error` field in post() above.
    onError: () => undefined,
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

  worker = IS_RENDERER ? spawnDomWorker() : makeInlineWorker();

  worker.onMessage((msg) => {
    const entry = pending.get(msg.id);
    if (entry === undefined) return;
    pending.delete(msg.id);
    if (msg.error !== undefined) {
      entry.reject(new Error(msg.error));
    } else {
      entry.resolve(msg.result);
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
