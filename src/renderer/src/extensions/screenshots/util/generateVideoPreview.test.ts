import { EventEmitter } from "node:events";
import path from "path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import generateVideoPreview from "./generateVideoPreview";

const { mockFs, mockSpawn, mockHasFfmpeg } = vi.hoisted(() => ({
  mockFs: {
    mkdir: vi.fn(),
    access: vi.fn(),
    utimes: vi.fn(),
    rename: vi.fn(),
  },
  mockSpawn: vi.fn(),
  mockHasFfmpeg: vi.fn(() => true),
}));

vi.mock("fs/promises", () => ({ default: mockFs }));

vi.mock("child_process", () => ({
  spawn: mockSpawn,
  spawnSync: vi.fn(),
  default: { spawn: mockSpawn, spawnSync: vi.fn() },
}));

vi.mock("./ffmpeg", () => ({ hasFfmpeg: mockHasFfmpeg }));

const PREVIEW_DIR = path.join("/tmp", "vortex-temp", "gamemediapreviews");

vi.mock("./previewCache", () => ({ previewDir: () => PREVIEW_DIR }));

/** Stands in for the ChildProcess: the test emits "exit"/"error" to settle the promise. */
const fakeProc = () => new EventEmitter();

const VIDEO = path.join("/videos", "clip.mp4");
const KEY = "abc123";
const OUT = path.join(PREVIEW_DIR, `${KEY}.jpg`);

describe("generateVideoPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockHasFfmpeg.mockReturnValue(true);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.access.mockRejectedValue(new Error("ENOENT")); // cache miss by default
    mockFs.utimes.mockResolvedValue(undefined);
    mockFs.rename.mockResolvedValue(undefined);
  });

  /** Starts a generation, waits for ffmpeg to be spawned, and hands back the proc + promise. */
  const startGeneration = async () => {
    const proc = fakeProc();
    mockSpawn.mockReturnValue(proc);

    const promise = generateVideoPreview(VIDEO, KEY);
    await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled());

    return { proc, promise };
  };

  it("returns undefined without spawning when ffmpeg is unavailable", async () => {
    mockHasFfmpeg.mockReturnValue(false);

    await expect(generateVideoPreview(VIDEO, KEY)).resolves.toBeUndefined();

    expect(mockSpawn).not.toHaveBeenCalled();
    expect(mockFs.mkdir).not.toHaveBeenCalled();
  });

  it("returns the cached preview and touches its mtime on a cache hit", async () => {
    mockFs.access.mockResolvedValue(undefined);

    await expect(generateVideoPreview(VIDEO, KEY)).resolves.toBe(OUT);

    expect(mockSpawn).not.toHaveBeenCalled();
    expect(mockFs.utimes).toHaveBeenCalledWith(OUT, expect.any(Date), expect.any(Date));
  });

  it("creates the preview directory before generating", async () => {
    const { proc, promise } = await startGeneration();
    proc.emit("exit", 0);
    await promise;

    expect(mockFs.mkdir).toHaveBeenCalledWith(PREVIEW_DIR, { recursive: true });
  });

  it("writes to a temp file and renames it into place on success", async () => {
    const { proc, promise } = await startGeneration();

    const args = mockSpawn.mock.lastCall[1] as string[];
    const tmpPath = args[args.length - 1];
    expect(tmpPath).toMatch(/\.tmp$/);
    expect(tmpPath).not.toBe(OUT);
    expect(args).toContain(VIDEO);

    proc.emit("exit", 0);

    await expect(promise).resolves.toBe(OUT);
    expect(mockFs.rename).toHaveBeenCalledWith(tmpPath, OUT);
  });

  it("resolves undefined and does not rename on a non-zero exit", async () => {
    const { proc, promise } = await startGeneration();

    proc.emit("exit", 1);

    await expect(promise).resolves.toBeUndefined();
    expect(mockFs.rename).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(window.api.log).toHaveBeenCalledWith("warn", expect.stringContaining("ffmpeg failed"));
  });

  it("resolves undefined when ffmpeg fails to spawn", async () => {
    const { proc, promise } = await startGeneration();

    proc.emit("error", new Error("ENOENT"));

    await expect(promise).resolves.toBeUndefined();
    expect(mockFs.rename).not.toHaveBeenCalled();
  });

  it("resolves undefined when the rename fails", async () => {
    mockFs.rename.mockRejectedValue(new Error("EPERM"));

    const { proc, promise } = await startGeneration();
    proc.emit("exit", 0);

    await expect(promise).resolves.toBeUndefined();
  });
});
