import type { Stats } from "fs";
import fs from "fs/promises";
import * as childProcess from "node:child_process";

import { describe, it, expect, vi, beforeEach } from "vitest";

import collectMedia from "./collectMedia";
import type { GameMediaSource } from "./mediaTypes";

/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/require-await */

vi.mock("fs/promises", () => ({
  default: {
    stat: vi.fn(),
    readdir: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn(),
  },
}));

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    spawn: vi.fn(),
    spawnSync: vi.fn(),
  };
});

describe("collectMedia", () => {
  const mockedFs = vi.mocked(fs);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("only scans sources not specified in disabled sources", async () => {
    mockedFs.stat.mockResolvedValue({} as Stats);
    mockedFs.readdir.mockResolvedValue(["someFile.png"] as any);

    const sources: Record<string, GameMediaSource> = {
      sourceA: {
        name: "A",
        path: "A",
      },
      sourceB: {
        name: "B",
        path: "B",
      },
    };
    const disabledSources: string[] = ["B"];

    const result = await collectMedia(sources, disabledSources);

    const resultSources = new Set(result.map((r) => r.sourceId));
    expect(resultSources).not.toContain(disabledSources[0]);
  });

  it("handles missing directories gracefully", async () => {
    mockedFs.stat.mockRejectedValue({ code: "ENOENT" });
    mockedFs.readdir.mockResolvedValue(["someFile.png"] as any);

    const sources: Record<string, GameMediaSource> = {
      sourceA: {
        name: "A",
        path: "A",
      },
    };

    const res = await collectMedia(sources, []);
    expect(res.length).toEqual(0);
  });

  it("selects only jpg/png/gif/bmp/mp4 files when no discoverFn is provided", async () => {
    mockedFs.stat.mockResolvedValue({} as Stats);
    mockedFs.readdir.mockResolvedValue([
      { name: "someFile.png", isFile: () => true },
      { name: "anotherfile.jpg", isFile: () => true },
      { name: "yetanotherfile.png", isFile: () => true },
      { name: "video.mp4", isFile: () => true },
      { name: "invalid.txt", isFile: () => true },
      { name: "folder", isFile: () => false },
    ] as any);

    const sources: Record<string, GameMediaSource> = {
      sourceA: {
        name: "A",
        path: "A",
      },
    };

    const result = await collectMedia(sources, []);

    const invalidResults = result.filter((r) => r.path.endsWith(".txt"));
    expect(invalidResults).toEqual([]);
  });

  it("uses custom filterFn to filter files by name", async () => {
    mockedFs.stat.mockResolvedValue({
      size: 1234,
      birthtime: new Date("2024-01-01"),
      mtime: new Date("2024-01-02"),
    } as Stats);
    mockedFs.readdir.mockResolvedValue([
      { name: "someFile-thumbnail.png", isFile: () => true },
      { name: "anotherfile.jpg", isFile: () => true },
      { name: "yetanotherfile-thumbnail.png", isFile: () => true },
      { name: "video.mp4", isFile: () => true },
    ] as any);

    const sources: Record<string, GameMediaSource> = {
      sourceA: {
        name: "A",
        path: "A",
        // filterFn: (s) => !s.includes("thumbnail"),
      },
    };

    const result = await collectMedia(sources, []);
    expect(result.map((r) => r.name)).toEqual(["anotherfile.jpg", "video.mp4"]);
  });

  it("returned items sorted by creation date", async () => {
    let statcounter = 1;
    mockedFs.stat.mockImplementation(async () => {
      const birthtime = new Date();
      birthtime.setDate(statcounter++);
      return {
        birthtime,
      } as any;
    });
    mockedFs.readdir.mockResolvedValue([
      { name: "someFile.png", isFile: () => true },
      { name: "anotherfile.jpg", isFile: () => true },
      { name: "yetanotherfile.png", isFile: () => true },
    ] as any);

    const sources: Record<string, GameMediaSource> = {
      sourceA: {
        name: "A",
        path: "A",
      },
    };

    const result = await collectMedia(sources, []);
    expect(result.length).toBeGreaterThan(0);
    const date0 = result[0].createdAt;
    const date1 = result[1].createdAt;
    expect(date0.getTime() > date1.getTime()).toEqual(true);
  });

  it("if a source has a discoverFn it should be called", async () => {
    mockedFs.stat.mockResolvedValue({} as any);
    mockedFs.readdir.mockResolvedValue([
      "someFile-thumbail.png",
      "anotherfile.jpg",
      "video.mp4",
      "invalid-thumbnail.png",
    ] as any);

    const discoverFn = vi.fn(async () => []);

    const sources: Record<string, GameMediaSource> = {
      sourceA: {
        name: "A",
        path: "A",
        discoverFn,
      },
    };

    await collectMedia(sources, []);
    expect(discoverFn).toHaveBeenNthCalledWith(1, "A");
  });

  it("only calls generateVideoPreview for mp4s", async () => {
    mockedFs.stat.mockResolvedValue({
      size: 1234,
      birthtime: new Date("2024-01-01"),
      mtime: new Date("2024-01-02"),
    } as Stats);
    mockedFs.readdir.mockResolvedValue([
      { name: "someFile-thumbnail.png", isFile: () => true },
      { name: "anotherfile.jpg", isFile: () => true },
      { name: "yetanotherfile-thumbnail.png", isFile: () => true },
      { name: "video.mp4", isFile: () => true },
    ] as any);
    mockedFs.access.mockResolvedValue();
    mockedFs.access.mockImplementation(async () => {
      throw new Error("ENOENT");
    });

    vi.mocked(childProcess.spawn).mockImplementation(() => {
      return {
        on: (event: string, handler: (code?: number) => void) => {
          if (event === "exit") handler(0);
          return undefined;
        },
      } as any;
    });

    // Pretend with FFMPEG installed
    vi.mocked(childProcess.spawnSync).mockImplementation(() => ({ status: 0 }) as any);

    const result = await collectMedia(
      {
        src: {
          name: "Test",
          path: "/tmp/media",
        },
      },
      [],
    );

    expect(childProcess.spawn).toHaveBeenCalledTimes(1);
    expect(childProcess.spawn).toHaveBeenCalledWith(
      "ffmpeg",
      expect.arrayContaining(["-i", "/tmp/media/video.mp4"]),
      expect.anything(),
    );
  });
});
