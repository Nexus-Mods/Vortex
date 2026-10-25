import type { FolderCheckInput, FolderCheckResult, FolderCheckStatus } from "@vortex/shared/ipc";
import { describe, expect, it, vi } from "vitest";

vi.mock("../ipc", () => ({ betterIpcMain: { handle: vi.fn() } }));
vi.mock("../logging", () => ({ log: vi.fn() }));

import { createFolderCheckService } from "./index";
import { FolderCheckUnavailable } from "./scan";

const input: FolderCheckInput = {
  appId: 489830,
  buildId: 1,
  steamPath: "C:\\Steam",
  gamePath: "C:\\Steam\\steamapps\\common\\Skyrim Special Edition",
  depots: [],
};

const result: FolderCheckResult = {
  checkedAt: 1,
  input,
  mode: "quick",
  files: [],
  missing: [],
  unreadable: [],
  baseFilesWithBackup: 0,
};

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe("createFolderCheckService", () => {
  it("runs once and serves the cached result", async () => {
    const run = vi.fn().mockResolvedValue(result);
    const service = createFolderCheckService(run);
    expect(service.status(489830)).toEqual({ state: "idle" });
    service.start(input, false, "quick");
    await settle();
    service.start(input, false, "quick");
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
    expect(service.status(489830)).toEqual({ state: "done", result });
  });

  it("reruns on force", async () => {
    const run = vi.fn().mockResolvedValue(result);
    const service = createFolderCheckService(run);
    service.start(input, false, "quick");
    await settle();
    service.start(input, true, "quick");
    await settle();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("runs the requested mode", async () => {
    const run = vi.fn().mockResolvedValue(result);
    const service = createFolderCheckService(run);
    service.start(input, true, "full");
    await settle();
    expect(run).toHaveBeenCalledWith(input, expect.any(Function), "full");
  });

  it("ignores start while running", async () => {
    let finish!: (value: FolderCheckResult) => void;
    const run = vi
      .fn()
      .mockReturnValue(new Promise<FolderCheckResult>((resolve) => (finish = resolve)));
    const service = createFolderCheckService(run);
    service.start(input, false, "quick");
    service.start(input, true, "quick");
    expect(run).toHaveBeenCalledTimes(1);
    expect(service.status(489830).state).toBe("running");
    finish(result);
    await settle();
    expect(service.status(489830).state).toBe("done");
  });

  it("reports progress while running", () => {
    const run = vi.fn(
      (
        _input: FolderCheckInput,
        onProgress: (status: Extract<FolderCheckStatus, { state: "running" }>) => void,
      ) => {
        onProgress({ state: "running", phase: "hashing", bytesDone: 5, bytesTotal: 10 });
        return new Promise<FolderCheckResult>(() => undefined);
      },
    );
    const service = createFolderCheckService(run);
    service.start(input, false, "quick");
    expect(service.status(489830)).toEqual({
      state: "running",
      phase: "hashing",
      bytesDone: 5,
      bytesTotal: 10,
    });
  });

  it("reports unavailable reasons", async () => {
    const run = vi.fn().mockRejectedValue(new FolderCheckUnavailable("x"));
    const service = createFolderCheckService(run);
    service.start(input, false, "quick");
    await settle();
    expect(service.status(489830)).toEqual({ state: "unavailable", reason: "x" });
  });

  it("reports other errors", async () => {
    const run = vi.fn().mockRejectedValue(new Error("boom"));
    const service = createFolderCheckService(run);
    service.start(input, false, "quick");
    await settle();
    expect(service.status(489830)).toEqual({ state: "error", message: "boom" });
  });
});
