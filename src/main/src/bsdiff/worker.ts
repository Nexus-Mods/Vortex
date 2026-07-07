/**
 * bsdiff patch worker. Runs on a main-process worker_thread so the wasm work
 * stays off both the renderer UI thread and the main event loop. The host
 * (host.ts) posts one job per message and every job is answered with exactly
 * one response carrying the same id, so a caller never hangs. The worker reads
 * and writes the files itself, so only paths cross the boundary, never buffers.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parentPort } from "node:worker_threads";

import { getErrorMessageOrDefault } from "@vortex/shared";

import { applyPatchFile, createPatchFile } from "./patch";
import type { BsdiffJob, BsdiffResult } from "./protocol";
import { loadWasm } from "./wasm";

if (parentPort === null) {
  throw new Error("bsdiff worker must run as a worker_thread");
}
const port = parentPort;

// hdiff.wasm is copied next to this bundle by src/main/build.mjs. Load it once;
// the instance is reused for every job.
const wasm = loadWasm(fs.readFileSync(path.join(__dirname, "hdiff.wasm")));

async function handleJob(job: BsdiffJob): Promise<void> {
  let result: BsdiffResult;
  try {
    if (job.op === "create") {
      await createPatchFile(wasm, job.oldPath, job.secondPath, job.outPath);
    } else {
      await applyPatchFile(wasm, job.oldPath, job.secondPath, job.outPath);
    }
    result = { id: job.id };
  } catch (err) {
    result = { id: job.id, error: getErrorMessageOrDefault(err) };
  }
  port.postMessage(result);
}

port.on("message", (job: BsdiffJob) => {
  void handleJob(job);
});
