import type { ChildProcess } from "child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules before importing elevated.ts
vi.mock("tmp", () => ({
  default: { file: vi.fn() },
  file: vi.fn(),
}));

vi.mock("fs", () => ({
  default: { write: vi.fn(), closeSync: vi.fn(), readFileSync: vi.fn() },
  write: vi.fn(),
  closeSync: vi.fn(),
  readFileSync: vi.fn(),
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
import { runElevated, _setSpawner, isSteamOS, _resetSteamOSCache } from "./elevated";
import { UserCanceled } from "./CustomErrors";

const FAKE_TMP = "/tmp/fake-elevated.js";
const FAKE_FD = 42;

/** Wire tmp.file and fs.write/closeSync to invoke their callbacks synchronously. */
function setupSyncMocks(tmpPath = FAKE_TMP) {
  vi.mocked(tmp.file).mockImplementation(
    (
      optsOrCb:
        | ((
            err: Error | null,
            path: string,
            fd: number,
            cleanup: () => void,
          ) => void)
        | object,
      cb?: (
        err: Error | null,
        path: string,
        fd: number,
        cleanup: () => void,
      ) => void,
    ) => {
      const callback =
        typeof optsOrCb === "function" ? optsOrCb : cb;
      if (callback) callback(null, tmpPath, FAKE_FD, vi.fn());
    },
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

describe("isSteamOS detection", () => {
  beforeEach(() => {
    _resetSteamOSCache();
    vi.mocked(fs.readFileSync).mockReset();
  });

  afterEach(() => {
    _resetSteamOSCache();
    vi.clearAllMocks();
  });

  it("returns true when ID=steamos", () => {
    vi.mocked(fs.readFileSync).mockReturnValue("ID=steamos\nID_LIKE=arch\n");
    expect(isSteamOS()).toBe(true);
  });

  it("returns true when ID_LIKE contains steamos", () => {
    vi.mocked(fs.readFileSync).mockReturnValue("ID=holoiso\nID_LIKE=arch steamos\n");
    expect(isSteamOS()).toBe(true);
  });

  it("returns false for Ubuntu", () => {
    vi.mocked(fs.readFileSync).mockReturnValue("ID=ubuntu\nID_LIKE=debian\n");
    expect(isSteamOS()).toBe(false);
  });

  it("returns false when /etc/os-release is missing", () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      const err: NodeJS.ErrnoException = new Error("ENOENT: no such file or directory");
      err.code = "ENOENT";
      throw err;
    });
    expect(isSteamOS()).toBe(false);
  });

  it("caches the result after the first call", () => {
    vi.mocked(fs.readFileSync).mockReturnValue("ID=steamos\n");
    isSteamOS();
    isSteamOS();
    expect(vi.mocked(fs.readFileSync)).toHaveBeenCalledTimes(1);
  });
});

describe("runElevated — SteamOS sudo -n fallback", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    _resetSteamOSCache();
    // Make isSteamOS() return true by feeding the right /etc/os-release content
    vi.mocked(fs.readFileSync).mockImplementation((filePath: unknown) => {
      if (filePath === "/etc/os-release") {
        return "ID=steamos\nID_LIKE=arch\n";
      }
      throw new Error("unexpected readFileSync call");
    });
    Object.defineProperty(process, "platform", {
      value: "linux",
      configurable: true,
    });
  });

  afterEach(() => {
    _resetSteamOSCache();
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  it("spawns sudo -n instead of pkexec on SteamOS", async () => {
    setupSyncMocks(FAKE_TMP);
    const { proc } = makeFakeProc();

    let capturedCmd: string | undefined;
    let capturedArgs: string[] | undefined;

    _setSpawner((cmd, args) => {
      capturedCmd = cmd;
      capturedArgs = args;
      return proc;
    });

    await runElevated("ipc-steamos-1", vi.fn());

    expect(capturedCmd).toBe("sudo");
    expect(capturedArgs).toEqual(["-n", process.execPath, "--run", FAKE_TMP]);
  });

  it("rejects with UserCanceled when sudo -n exits with code 1", async () => {
    setupSyncMocks(FAKE_TMP);

    // Use makeEarlyCloseSpawner to fire close before resolve
    const proc = {
      on(event: string, handler: (...args: unknown[]) => void) {
        if (event === "close") {
          (handler as (code: number | null) => void)(1);
        }
        return this;
      },
    } as unknown as ChildProcess;
    _setSpawner(() => proc);

    const err = await runElevated("ipc-steamos-2", vi.fn()).catch((e) => e);
    expect(err).toBeInstanceOf(UserCanceled);
    expect((err as any).message).toContain("Game Mode");
  });

  it("rejects with UserCanceled when sudo ENOENT (not on PATH)", async () => {
    setupSyncMocks(FAKE_TMP);

    const proc = {
      on(event: string, handler: (...args: unknown[]) => void) {
        if (event === "error") {
          const spawnErr: NodeJS.ErrnoException = new Error("spawn sudo ENOENT");
          spawnErr.code = "ENOENT";
          handler(spawnErr);
        }
        return this;
      },
    } as unknown as ChildProcess;
    _setSpawner(() => proc);

    const err = await runElevated("ipc-steamos-3", vi.fn()).catch((e) => e);
    expect(err).toBeInstanceOf(UserCanceled);
    expect((err as any).message).toContain("Game Mode");
  });
});

describe("runElevated — non-SteamOS Linux still uses pkexec", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    _resetSteamOSCache();
    // Make isSteamOS() return false
    vi.mocked(fs.readFileSync).mockImplementation((filePath: unknown) => {
      if (filePath === "/etc/os-release") {
        return "ID=ubuntu\nID_LIKE=debian\n";
      }
      throw new Error("unexpected readFileSync call");
    });
    Object.defineProperty(process, "platform", {
      value: "linux",
      configurable: true,
    });
  });

  afterEach(() => {
    _resetSteamOSCache();
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  it("spawns pkexec on non-SteamOS Linux", async () => {
    setupSyncMocks(FAKE_TMP);
    const { proc } = makeFakeProc();

    let capturedCmd: string | undefined;

    _setSpawner((cmd, _args) => {
      capturedCmd = cmd;
      return proc;
    });

    await runElevated("ipc-nonsteamos-1", vi.fn());

    expect(capturedCmd).toBe("pkexec");
  });
});

describe("runElevated — Linux pkexec branch", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    _resetSteamOSCache();
    // Return non-SteamOS content so isSteamOS() is false and pkexec is used
    vi.mocked(fs.readFileSync).mockImplementation((filePath: unknown) => {
      if (filePath === "/etc/os-release") {
        return "ID=ubuntu\nID_LIKE=debian\n";
      }
      throw new Error("unexpected readFileSync call");
    });
    Object.defineProperty(process, "platform", {
      value: "linux",
      configurable: true,
    });
  });

  afterEach(() => {
    _resetSteamOSCache();
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
