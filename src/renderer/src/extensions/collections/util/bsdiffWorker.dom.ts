/**
 * DOM Worker used inside the Electron renderer. The main thread (bsdiff.ts)
 * hands the WASM bytes over via an `init` message before any op, so the worker
 * needs no filesystem access or URL query parsing. Every request is answered
 * with exactly one response (success or error) so the caller never hangs.
 */

import { getErrorMessageOrDefault } from "@vortex/shared";

import type { BsdiffInit, BsdiffRequest, BsdiffResponse, BsdiffWasmExports } from "./bsdiffWasm";
import { loadWasm, processRequest } from "./bsdiffWasm";

interface WorkerSelf {
  addEventListener(
    type: "message",
    listener: (evt: MessageEvent<BsdiffInit | BsdiffRequest>) => void,
  ): void;
  postMessage(message: BsdiffResponse, transfer: ArrayBuffer[]): void;
}
declare const self: WorkerSelf;

let wasmExports: BsdiffWasmExports | undefined;
// If the WASM module fails to instantiate during init, remember why so the
// first op reports the real cause instead of a generic "not initialized".
let initError: string | undefined;

self.addEventListener("message", (evt) => {
  const data = evt.data;

  if ((data as BsdiffInit).init === true) {
    try {
      wasmExports = loadWasm((data as BsdiffInit).wasm);
    } catch (err) {
      initError = getErrorMessageOrDefault(err);
    }
    return;
  }

  const req = data as BsdiffRequest;
  let response: BsdiffResponse;
  try {
    if (wasmExports === undefined) {
      throw new Error(initError ?? "bsdiff worker received a request before initialization");
    }
    response = processRequest(wasmExports, req);
  } catch (err) {
    response = { id: req.id, error: getErrorMessageOrDefault(err) };
  }

  const transfer = response.result ? [response.result.buffer as ArrayBuffer] : [];
  self.postMessage(response, transfer);
});
