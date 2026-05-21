/**
 * DOM Worker used inside the Electron renderer. Relies on
 * `nodeIntegrationInWorker: true` for `fs` access (configured on
 * MainWindow). Wasm path is passed via the worker URL's query string so
 * we don't need a separate init handshake.
 */

import * as fs from "fs";

import type { BsdiffRequest, BsdiffWasmExports } from "./bsdiffWasm";
import { loadWasm, processRequest } from "./bsdiffWasm";

interface WorkerSelf {
  location: { search: string };
  addEventListener(type: "message", listener: (evt: MessageEvent<BsdiffRequest>) => void): void;
  postMessage(message: unknown, transfer: ArrayBuffer[]): void;
}
declare const self: WorkerSelf;

let wasmExports: BsdiffWasmExports | undefined;

function getWasm(): BsdiffWasmExports {
  if (wasmExports !== undefined) return wasmExports;
  const wasmPath = new URLSearchParams(self.location.search).get("wasmPath");
  if (wasmPath === null) {
    throw new Error("bsdiff worker started without wasmPath query parameter");
  }
  wasmExports = loadWasm(fs.readFileSync(wasmPath));
  return wasmExports;
}

self.addEventListener("message", (evt) => {
  const response = processRequest(getWasm(), evt.data);
  const transfer = response.result ? [response.result.buffer as ArrayBuffer] : [];
  self.postMessage(response, transfer);
});
