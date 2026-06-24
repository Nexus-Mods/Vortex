/**
 * Pure bsdiff WASM helpers (BSDIFF40-compatible). No worker and no I/O, so they
 * run in any context: the patch worker thread, a direct caller, or a test.
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

const BSDIFF_OK = 0;

export function loadWasm(wasmBytes: Uint8Array): BsdiffWasmExports {
  const wasmModule = new WebAssembly.Module(wasmBytes as unknown as BufferSource);
  const instance = new WebAssembly.Instance(wasmModule);
  return instance.exports as unknown as BsdiffWasmExports;
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

function runOp(
  wasm: BsdiffWasmExports,
  name: "create_patch" | "apply_patch",
  left: Uint8Array,
  right: Uint8Array,
): Uint8Array {
  const status = runBinaryOp(wasm, left, right, wasm[name]);
  if (status !== BSDIFF_OK) {
    throw new Error(`bsdiff ${name} failed with status ${status}`);
  }
  return readOutput(wasm);
}

/** Create a BSDIFF40 patch between two buffers. Throws on a non-OK wasm status. */
export function createPatch(
  wasm: BsdiffWasmExports,
  oldBuf: Uint8Array,
  newBuf: Uint8Array,
): Uint8Array {
  return runOp(wasm, "create_patch", oldBuf, newBuf);
}

/** Apply a BSDIFF40 patch to a buffer. Throws on a non-OK wasm status. */
export function applyPatch(
  wasm: BsdiffWasmExports,
  oldBuf: Uint8Array,
  patchBuf: Uint8Array,
): Uint8Array {
  return runOp(wasm, "apply_patch", oldBuf, patchBuf);
}
