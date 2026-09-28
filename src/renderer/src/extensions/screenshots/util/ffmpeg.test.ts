import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSpawnSync } = vi.hoisted(() => ({ mockSpawnSync: vi.fn() }));

vi.mock("child_process", () => ({
  spawn: vi.fn(),
  spawnSync: mockSpawnSync,
  default: { spawn: vi.fn(), spawnSync: mockSpawnSync },
}));

describe("hasFfmpeg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("reports ffmpeg as available and probes only once", async () => {
    mockSpawnSync.mockReturnValue({ status: 0 });
    const { hasFfmpeg } = await import("./ffmpeg.js");

    expect(hasFfmpeg()).toBe(true);
    expect(hasFfmpeg()).toBe(true);
    expect(mockSpawnSync).toHaveBeenCalledTimes(1);
    expect(mockSpawnSync).toHaveBeenCalledWith("ffmpeg", ["-version"], { stdio: "ignore" });
  });

  it("reports ffmpeg as unavailable on a non-zero status", async () => {
    mockSpawnSync.mockReturnValue({ status: 1 });
    const { hasFfmpeg } = await import("./ffmpeg.js");

    expect(hasFfmpeg()).toBe(false);
  });
});
