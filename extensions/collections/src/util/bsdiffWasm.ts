/**
 * Pure bsdiff WASM helpers. No worker, no I/O — safe to use from any
 * context (renderer, Node worker_threads worker, DOM Worker).
 */

export interface BsdiffWasmExports {
  memory: WebAssembly.Memory;
  alloc(size: number): number;
  dealloc(ptr: number, size: number): void;
  create_patch(basePtr: number, baseLen: number, nextPtr: number, nextLen: number): number;
  apply_patch(basePtr: number, baseLen: number, patchPtr: number, patchLen: number): number;
  output_ptr(): number;
  output_len(): number;
  free_output(): void;
}

export const BSDIFF_OK = 0;

export function loadWasm(wasmBytes: Uint8Array): BsdiffWasmExports {
  const wasmModule = new WebAssembly.Module(wasmBytes as unknown as BufferSource);
  const instance = new WebAssembly.Instance(wasmModule);
  return instance.exports as unknown as BsdiffWasmExports;
}

export function runBinaryOp(
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

export function readOutput(wasm: BsdiffWasmExports): Uint8Array {
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

export function processRequest(wasm: BsdiffWasmExports, msg: BsdiffRequest): BsdiffResponse {
  try {
    const op = msg.op === "create_patch" ? wasm.create_patch : wasm.apply_patch;
    const status = runBinaryOp(wasm, msg.left, msg.right, op);
    if (status !== BSDIFF_OK) {
      return { id: msg.id, error: `bsdiff ${msg.op} failed with status ${status}` };
    }
    return { id: msg.id, result: readOutput(wasm) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { id: msg.id, error: message };
  }
}
