import type { ChildProcess } from "child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules before importing elevated.ts
vi.mock("tmp", () => ({
  default: { file: vi.fn() },
  file: vi.fn(),
}));

vi.mock("fs", () => ({
  default: { write: vi.fn(), closeSync: vi.fn() },
  write: vi.fn(),
  closeSync: vi.fn(),
}));

vi.mock("winapi-bindings", () => ({
  default: { ShellExecuteEx: vi.fn() },
  ShellExecuteEx: vi.fn(),
}));

vi.mock("./ipc", () => ({
  getIPCPath: vi.fn((id: string) => `/tmp/vortex-ipc-${id}`),
}));

vi.mock("./webpack-hacks", () => ({
  getRealNodeModulePaths: vi.fn(() => ["/fake/node_modules"]),
}));

import * as tmp from "tmp";
import * as fs from "fs";
import { runElevated, _setSpawner } from "./elevated";
import { UserCanceled } from "./CustomErrors";

const FAKE_TMP = "/tmp/fake-elevated.js";
const FAKE_FD = 42;

/** Wire tmp.file and fs.write/closeSync to invoke their callbacks synchronously. */
function setupSyncMocks(tmpPath = FAKE_TMP) {
  vi.mocked(tmp.file).mockImplementation(
    (
      cb: (
        err: Error | null,
        path: string,
        fd: number,
        cleanup: () => void,
      ) => void,
    ) => cb(null, tmpPath, FAKE_FD, vi.fn()),
  );

  vi.mocked(fs.write).mockImplementation(
    (
      _fd: unknown,
      _data: unknown,
      cb: (err: NodeJS.ErrnoException | null, written: number, str: string) => void,
    ) => cb(null, 0, ""),
  );

  vi.mocked(fs.closeSync).mockImplementation(() => undefined);
}

/**
 * Create a spawner that fires the close event synchronously with the given code
 * immediately when the proc's 'on' method is called (i.e., as soon as elevated.ts
 * registers the close handler, we call it back). This makes close fire BEFORE
 * `return resolve(tmpPath)` executes, so reject wins the promise race.
 */
function makeEarlyCloseSpawner(exitCode: number) {
  const proc = {
    on(event: string, handler: (...args: unknown[]) => void) {
      if (event === "close") {
        // Call handler synchronously — before resolve(tmpPath) fires
        (handler as (code: number | null) => void)(exitCode);
      }
      return this;
    },
  } as unknown as ChildProcess;

  return () => proc;
}

/**
 * Build a minimal fake ChildProcess that records the close handler.
 * The handler can be fired later by calling fireClose().
 */
function makeFakeProc() {
  let closeHandler: ((code: number | null) => void) | null = null;

  const proc = {
    on(event: string, handler: (...args: unknown[]) => void) {
      if (event === "close") {
        closeHandler = handler as (code: number | null) => void;
      }
      return this;
    },
  } as unknown as ChildProcess;

  return {
    proc,
    fireClose(code: number | null) {
      if (closeHandler) closeHandler(code);
    },
    get hasCloseHandler() {
      return closeHandler !== null;
    },
  };
}

describe("runElevated — Linux pkexec branch", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    Object.defineProperty(process, "platform", {
      value: "linux",
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  it("Test 1: spawner is called with 'pkexec' and [execPath, '--run', tmpPath]", async () => {
    setupSyncMocks(FAKE_TMP);
    const { proc } = makeFakeProc();

    let capturedCmd: string | undefined;
    let capturedArgs: string[] | undefined;

    _setSpawner((cmd, args) => {
      capturedCmd = cmd;
      capturedArgs = args;
      return proc;
    });

    await runElevated("ipc-1", vi.fn());

    expect(capturedCmd).toBe("pkexec");
    expect(capturedArgs).toEqual([process.execPath, "--run", FAKE_TMP]);
  });

  it("Test 2: exit code 0 — promise resolves with tmpPath", async () => {
    setupSyncMocks(FAKE_TMP);
    const { proc } = makeFakeProc();
    _setSpawner(() => proc);

    const result = await runElevated("ipc-2", vi.fn());
    expect(result).toBe(FAKE_TMP);
  });

  it("Test 3: exit code 126 — close handler rejects with UserCanceled", async () => {
    // Fire close synchronously inside proc.on() so reject wins before resolve
    setupSyncMocks(FAKE_TMP);
    _setSpawner(makeEarlyCloseSpawner(126));

    await expect(runElevated("ipc-3", vi.fn())).rejects.toBeInstanceOf(UserCanceled);
  });

  it("Test 4: exit code 127 — close handler rejects with Error containing '127'", async () => {
    setupSyncMocks(FAKE_TMP);
    _setSpawner(makeEarlyCloseSpawner(127));

    await expect(runElevated("ipc-4", vi.fn())).rejects.toSatisfy(
      (err: unknown) => err instanceof Error && err.message.includes("127"),
    );
  });

  it("Test 5: exit code 1 — close handler rejects with Error containing '1'", async () => {
    setupSyncMocks(FAKE_TMP);
    _setSpawner(makeEarlyCloseSpawner(1));

    await expect(runElevated("ipc-5", vi.fn())).rejects.toSatisfy(
      (err: unknown) => err instanceof Error && err.message.includes("1"),
    );
  });

  it("Test 6: resolve(tmpPath) is returned immediately after spawn, before close fires", async () => {
    // With a proc that never fires close, the promise still resolves
    setupSyncMocks(FAKE_TMP);
    const { proc } = makeFakeProc();
    _setSpawner(() => proc);

    const result = await Promise.race([
      runElevated("ipc-6", vi.fn()),
      new Promise<never>((_res, rej) =>
        setTimeout(() => rej(new Error("timed out — resolve did not fire immediately")), 100),
      ),
    ]);

    expect(result).toBe(FAKE_TMP);
  });

  it("Test 7: _setSpawner replaces the default spawner (injectable seam works)", async () => {
    setupSyncMocks(FAKE_TMP);
    const { proc } = makeFakeProc();

    let called = false;
    _setSpawner((_cmd, _args) => {
      called = true;
      return proc;
    });

    await runElevated("ipc-7", vi.fn());

    expect(called).toBe(true);
  });
});
