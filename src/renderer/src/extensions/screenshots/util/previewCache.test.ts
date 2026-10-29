import type { Stats } from "fs";
import path from "path";

import { describe, it, expect, vi, beforeEach } from "vitest";

import { prunePreviewCache, previewDir } from "./previewCache";

const { mockFs } = vi.hoisted(() => ({
  mockFs: {
    stat: vi.fn<(p: string) => Promise<Stats>>(),
    readdir: vi.fn<(dir: string) => Promise<string[]>>(),
    unlink: vi.fn<(p: string) => Promise<void>>(),
  },
}));

const at = (name: string) => path.join(previewDir(), name);

vi.mock("fs/promises", () => ({
  default: mockFs,
}));

vi.mock("@/util/getVortexPath", () => ({
  default: vi.fn(() => "/tmp/vortex-temp"),
}));

describe("prunePreviewCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes any stale previews", async () => {
    mockFs.readdir.mockResolvedValue(["a.jpg", "b.jpg", "c.jpg"]);
    mockFs.stat.mockImplementation(
      (path: string): Promise<Stats> =>
        Promise.resolve({
          isFile: () => true,
          mtimeMs: path === at("a.jpg") ? Date.now() : 0,
          size: 100,
        } as unknown as Stats),
    );
    mockFs.unlink.mockResolvedValue();

    await prunePreviewCache();
    expect(mockFs.unlink).toHaveBeenCalledTimes(2);
  });

  it("deletes any orphaned tmp files", async () => {
    const thirtyMinsMs = 30 * 60 * 1000;
    mockFs.readdir.mockResolvedValue(["a.jpg.tmp", "b.jpg.tmp", "c.jpg"]);
    mockFs.stat.mockImplementation((path: string) =>
      Promise.resolve({
        isFile: () => true,
        mtimeMs: path === at("a.jpg.tmp") ? Date.now() - thirtyMinsMs : 0,
        size: 100,
      } as unknown as Stats),
    );
    mockFs.unlink.mockResolvedValue();

    await prunePreviewCache();
    expect(mockFs.unlink).not.toHaveBeenCalledWith(
      path.join("/tmp/vortex-temp", "gamemediapreviews", "a.jpg.tmp"),
    );
    expect(mockFs.unlink).toHaveBeenCalledWith(
      path.join("/tmp/vortex-temp", "gamemediapreviews", "b.jpg.tmp"),
    );
    expect(mockFs.unlink).toHaveBeenCalledTimes(2);
  });

  it("ignores directories", async () => {
    mockFs.readdir.mockResolvedValue(["a.jpg", "subdir"]);
    mockFs.stat.mockImplementation(
      (p: string): Promise<Stats> =>
        Promise.resolve({
          isFile: () => p !== at("subdir"),
          mtimeMs: 0,
          size: 100,
        } as unknown as Stats),
    );

    await prunePreviewCache();
    expect(mockFs.unlink).not.toHaveBeenCalledWith(at("subdir"));
  });

  it("clears out larger and older files when the cache becomes large", async () => {
    mockFs.readdir.mockResolvedValue(["one.jpg", "two.jpg", "three.jpg", "four.jpg", "five.jpg"]);

    mockFs.stat.mockImplementation(
      (p: string): Promise<Stats> =>
        Promise.resolve({
          isFile: () => p !== at("subdir"),
          mtimeMs: new Date().getTime(),
          size: 60000000,
        } as unknown as Stats),
    );

    await prunePreviewCache();
    expect(mockFs.unlink).toHaveBeenCalledTimes(2);
  });
});
