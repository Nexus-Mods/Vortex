import path from "path";

import { describe, expect, vi, beforeEach, it } from "vitest";

import generateVideoPreview from "./generateVideoPreview";

const { mockFs, mockSpawn, mockHasFfmpeg } = vi.hoisted(() => ({
  mockFs: {
    mkdir: vi.fn(),
    access: vi.fn(),
    utimes: vi.fn(),
    rename: vi.fn(),
  },
  mockSpawn: vi.fn(),
  mockHasFfmpeg: vi.fn(),
}));

const PREVIEW_DIR = path.join("/tmp", "vortex-temp", "gamemediapreviews");
const VIDEO = path.join("/videos", "clip.mp4");
const KEY = "abc123";

vi.mock("fs/promises", () => ({ default: mockFs }));

vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  spawn: mockSpawn,
}));

vi.mock("./previewCache", () => ({
  previewDir: () => PREVIEW_DIR,
}));

vi.mock("./ffmpeg", () => ({ hasFfmpeg: mockHasFfmpeg }));

describe("generateVideoPreview - noffmpeg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.mkdir.mockResolvedValue(undefined);
    mockHasFfmpeg.mockReturnValue(false);
  });

  it("returns undefined without spawning when ffmpeg is unavailable", async () => {
    await expect(generateVideoPreview(VIDEO, KEY)).resolves.toBeUndefined();

    expect(mockFs.mkdir).not.toHaveBeenCalled();
  });
});
