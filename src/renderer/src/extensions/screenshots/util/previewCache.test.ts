import type { Stats } from "fs";
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs/promises";
import path from "path";

import { describe, it, expect, vi, beforeEach } from "vitest";

import { prunePreviewCache, previewDir } from "./previewCache";

const at = (name: string) => path.join(previewDir(), name);

vi.mock("fs/promises", () => ({
  default: {
    stat: vi.fn(),
    readdir: vi.fn(),
    unlink: vi.fn(),
  },
}));

vi.mock("@/util/getVortexPath", () => ({
  default: vi.fn(() => "/tmp/vortex-temp"),
}));

describe("prunePreviewCache", () => {
  const mockedFs = vi.mocked(fs);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes any stale previews", async () => {
    mockedFs.readdir.mockResolvedValue(["a.jpg", "b.jpg", "c.jpg"] as any);
    mockedFs.stat.mockImplementation(
      async (path: string): Promise<Stats> =>
        ({
          isFile: () => true,
          mtimeMs: path === at("a.jpg") ? Date.now() : 0,
          size: 100,
        }) as any,
    );
    mockedFs.unlink.mockResolvedValue();

    await prunePreviewCache();
    expect(mockedFs.unlink).toHaveBeenCalledTimes(2);
  });

  it("deletes any orphaned tmp files", async () => {
    const thirtyMinsMs = 30 * 60 * 1000;
    mockedFs.readdir.mockResolvedValue(["a.jpg.tmp", "b.jpg.tmp", "c.jpg"] as any);
    mockedFs.stat.mockImplementation(
      async (path: string): Promise<Stats> =>
        ({
          isFile: () => true,
          mtimeMs: path === at("a.jpg.tmp") ? Date.now() - thirtyMinsMs : 0,
          size: 100,
        }) as any,
    );
    mockedFs.unlink.mockResolvedValue();

    await prunePreviewCache();
    expect(mockedFs.unlink).not.toHaveBeenCalledWith(
      path.join("/tmp/vortex-temp", "gamemediapreviews", "a.jpg.tmp"),
    );
    expect(mockedFs.unlink).toHaveBeenCalledWith(
      path.join("/tmp/vortex-temp", "gamemediapreviews", "b.jpg.tmp"),
    );
    expect(mockedFs.unlink).toHaveBeenCalledTimes(2);
  });

  it("ignores directories", async () => {
    mockedFs.readdir.mockResolvedValue(["a.jpg", "subdir"] as any);
    mockedFs.stat.mockImplementation(
      async (p: string): Promise<Stats> =>
        ({
          isFile: () => p !== at("subdir"),
          mtimeMs: 0,
          size: 100,
        }) as any,
    );

    await prunePreviewCache();
    expect(mockedFs.unlink).not.toHaveBeenCalledWith(at("subdir"));
  });

  it("clears out larger and older files when the cache becomes large", async () => {
    mockedFs.readdir.mockResolvedValue([
      "one.jpg",
      "two.jpg",
      "three.jpg",
      "four.jpg",
      "five.jpg",
    ] as any);

    mockedFs.stat.mockImplementation(
      async (p: string): Promise<Stats> =>
        ({
          isFile: () => p !== at("subdir"),
          mtimeMs: new Date().getTime(),
          size: 60000000,
        }) as any,
    );

    await prunePreviewCache();
    expect(mockedFs.unlink).toHaveBeenCalledTimes(2);
  });
});
