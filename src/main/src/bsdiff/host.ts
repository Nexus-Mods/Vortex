/**
 * Owns the single persistent bsdiff worker_thread for the main process and
 * exposes promise-returning file operations. The worker is spawned lazily on
 * the first job, loads its wasm once, and matches each job to its response by
 * id. A crashed worker rejects every in-flight job and is respawned on the next
 * call.
 */

import * as path from "node:path";
import { Worker } from "node:worker_threads";

import type { BsdiffJob, BsdiffResult } from "./protocol";

const WORKER_SCRIPT = path.join(__dirname, "bsdiff-worker.cjs");

interface Pending {
  resolve: () => void;
  reject: (err: Error) => void;
}

let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<number, Pending>();

function failAll(err: Error): void {
  for (const entry of pending.values()) {
    entry.reject(err);
  }
  pending.clear();
  worker = undefined;
}

function getWorker(): Worker {
  if (worker !== undefined) {
    return worker;
  }
  const spawned = new Worker(WORKER_SCRIPT);
  spawned.on("message", (result: BsdiffResult) => {
    const entry = pending.get(result.id);
    if (entry === undefined) {
      return;
    }
    pending.delete(result.id);
    if (result.error !== undefined) {
      entry.reject(new Error(result.error));
    } else {
      entry.resolve();
    }
  });
  spawned.on("error", failAll);
  spawned.on("exit", (code) => {
    if (code !== 0) {
      failAll(new Error(`bsdiff worker stopped unexpectedly (exit code ${code})`));
    }
  });
  // Don't let an idle worker keep the main process alive at shutdown; any
  // in-flight job at quit time is abandoned, which is acceptable.
  spawned.unref();
  worker = spawned;
  return spawned;
}

function post(
  op: BsdiffJob["op"],
  oldPath: string,
  secondPath: string,
  outPath: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, op, oldPath, secondPath, outPath } satisfies BsdiffJob);
  });
}

/** Create a BSDIFF40 patch file from two files. Runs off-thread on the worker. */
export function diffFiles(oldPath: string, newPath: string, patchPath: string): Promise<void> {
  return post("create", oldPath, newPath, patchPath);
}

/** Apply a BSDIFF40 patch file, writing the result to outputPath. Runs off-thread. */
export function patchFiles(oldPath: string, outputPath: string, patchPath: string): Promise<void> {
  return post("apply", oldPath, patchPath, outputPath);
}

/** Terminate the worker if one is running. Call during app shutdown. */
export async function shutdownBsdiffWorker(): Promise<void> {
  const running = worker;
  worker = undefined;
  if (running !== undefined) {
    await running.terminate();
  }
}
