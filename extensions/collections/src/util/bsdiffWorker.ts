/**
 * Node `worker_threads` worker used for tests (which run under vitest's
 * node environment). Production / Electron renderer uses the DOM worker
 * variant in bsdiffWorker.dom.ts.
 */

import * as fs from "fs";
import { parentPort, workerData } from "worker_threads";

// .ts extension is required so Node's --experimental-strip-types can resolve
// this import when vitest runs the worker source directly.
import type { BsdiffRequest, BsdiffWasmExports } from "./bsdiffWasm.ts";
import { loadWasm, processRequest } from "./bsdiffWasm.ts";

let wasmExports: BsdiffWasmExports | undefined;

function getWasm(): BsdiffWasmExports {
  if (wasmExports !== undefined) return wasmExports;
  const wasmPath: string = (workerData as { wasmPath: string }).wasmPath;
  wasmExports = loadWasm(fs.readFileSync(wasmPath));
  return wasmExports;
}

parentPort!.on("message", (msg: BsdiffRequest) => {
  const response = processRequest(getWasm(), msg);
  const transfer = response.result ? [response.result.buffer as ArrayBuffer] : [];
  parentPort!.postMessage(response, transfer);
});
