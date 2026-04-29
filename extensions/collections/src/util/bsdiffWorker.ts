/**
 * Worker thread that loads the bsdiff WASM module and processes
 * diff/patch requests. Runs the blocking WASM computation off
 * the main thread.
 */

import { parentPort, workerData } from "worker_threads";
import * as fs from "fs";

// --- WASM interface ---

interface BsdiffWasmExports {
  memory: WebAssembly.Memory;
  alloc(size: number): number;
  dealloc(ptr: number, size: number): void;
  create_patch(
    basePtr: number,
    baseLen: number,
    nextPtr: number,
    nextLen: number,
  ): number;
  apply_patch(
    basePtr: number,
    baseLen: number,
    patchPtr: number,
    patchLen: number,
  ): number;
  output_ptr(): number;
  output_len(): number;
  free_output(): void;
}

const BSDIFF_OK = 0;

let wasmExports: BsdiffWasmExports | undefined;

function loadWasm(): BsdiffWasmExports {
  if (wasmExports !== undefined) return wasmExports;
  const wasmPath: string = (workerData as { wasmPath: string }).wasmPath;
  const wasmBuf = fs.readFileSync(wasmPath);
  const wasmModule = new WebAssembly.Module(wasmBuf);
  const instance = new WebAssembly.Instance(wasmModule);
  wasmExports = instance.exports as unknown as BsdiffWasmExports;
  return wasmExports;
}

function runBinaryOp(
  wasm: BsdiffWasmExports,
  left: Uint8Array,
  right: Uint8Array,
  op: (lPtr: number, lLen: number, rPtr: number, rLen: number) => number,
): number {
  const lPtr = wasm.alloc(left.byteLength);
  const rPtr = wasm.alloc(right.byteLength);
  try {
    if (left.byteLength > 0) {
      new Uint8Array(wasm.memory.buffer, lPtr, left.byteLength).set(left);
    }
    if (right.byteLength > 0) {
      new Uint8Array(wasm.memory.buffer, rPtr, right.byteLength).set(right);
    }
    return op(lPtr, left.byteLength, rPtr, right.byteLength);
  } finally {
    if (left.byteLength > 0) wasm.dealloc(lPtr, left.byteLength);
    if (right.byteLength > 0) wasm.dealloc(rPtr, right.byteLength);
  }
}

function readOutput(wasm: BsdiffWasmExports): Uint8Array {
  const ptr = wasm.output_ptr();
  const len = wasm.output_len();
  if (len === 0) {
    wasm.free_output();
    return new Uint8Array();
  }
  const result = new Uint8Array(new Uint8Array(wasm.memory.buffer, ptr, len));
  wasm.free_output();
  return result;
}

// --- Message handling ---

export interface BsdiffRequest {
  id: number;
  op: "create_patch" | "apply_patch";
  left: Uint8Array;
  right: Uint8Array;
}

export interface BsdiffResponse {
  id: number;
  result?: Uint8Array;
  error?: string;
}

parentPort!.on("message", (msg: BsdiffRequest) => {
  try {
    const wasm = loadWasm();
    let status: number;
    if (msg.op === "create_patch") {
      status = runBinaryOp(wasm, msg.left, msg.right, (bp, bl, np, nl) =>
        wasm.create_patch(bp, bl, np, nl),
      );
    } else {
      status = runBinaryOp(wasm, msg.left, msg.right, (bp, bl, pp, pl) =>
        wasm.apply_patch(bp, bl, pp, pl),
      );
    }
    if (status !== BSDIFF_OK) {
      parentPort!.postMessage({
        id: msg.id,
        error: `bsdiff ${msg.op} failed with status ${status}`,
      } as BsdiffResponse);
      return;
    }
    const output = readOutput(wasm);
    parentPort!.postMessage(
      { id: msg.id, result: output } as BsdiffResponse,
      [output.buffer as ArrayBuffer],
    );
  } catch (err: any) {
    parentPort!.postMessage({
      id: msg.id,
      error: err?.message ?? String(err),
    } as BsdiffResponse);
  }
});
