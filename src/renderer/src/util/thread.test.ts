import { describe, it, expect, vi, beforeEach } from "vitest";

const PROJECT_ROOT = "C:\\Users\\O'Brien\\Vortex\\node_modules";
const MODULE_BASE = "C:\\Users\\O'Brien\\AppData\\Roaming\\Vortex\\plugins\\some-extension";

vi.mock("./webpack-hacks", () => ({
  getRealNodeModulePaths: () => [PROJECT_ROOT],
}));

vi.mock("tmp", () => ({
  file: (
    _opts: Record<string, unknown>,
    callback: (err: Error | null, path: string, fd: number, cleanup: () => void) => void,
  ) => callback(null, "/tmp/xyz.js", 42, () => undefined),
}));

let mockWrites: string[] = [];

vi.mock("fs", () => ({
  write: (
    _fd: number,
    data: string,
    callback: (err: Error | null, written: number, str: string) => void,
  ) => {
    mockWrites.push(data);
    callback(null, data.length, "");
  },
  close: (_fd: number, callback: () => void) => callback(),
}));

// runThreaded hands the program to a web Worker, which doesn't exist under vitest.
class FakeWorker {
  public onmessage: (evt: { data: unknown }) => void = () => undefined;
  constructor(_path: string) {
    setTimeout(() => this.onmessage({ data: "done" }), 0);
  }
}
(globalThis as any).Worker = FakeWorker;

import { runThreaded } from "./thread";

// Executes the generated program the way the worker would and returns what main() posted.
function runProgram(prog: string): unknown {
  let posted: unknown;
  new Function("require", "module", "postMessage", "close", prog)(
    require,
    { paths: [] },
    (result: unknown) => {
      posted = result;
    },
    () => undefined,
  );
  return posted;
}

describe("runThreaded", () => {
  beforeEach(() => {
    mockWrites = [];
  });

  it("generates a valid program when paths contain an apostrophe", async () => {
    // baseDir and moduleRoot are top-level bindings of the generated program,
    // so a serialized main() can read them.
    const probe = new Function("return [baseDir, moduleRoot];") as () => string[];

    await runThreaded(probe, MODULE_BASE, "arg");

    expect(mockWrites.length).toBe(1);
    expect(runProgram(mockWrites[0])).toEqual([
      MODULE_BASE.replace(/\\/g, "/"),
      PROJECT_ROOT.replace(/\\/g, "/"),
    ]);
  });
});
