import type { Dirent, Stats } from "fs";
import path from "path";

import { describe, it, expect, vi, beforeEach } from "vitest";

import collectMedia from "./collectMedia";
import generateVideoPreview from "./generateVideoPreview";
import type { ResolvedGameMediaSource } from "./mediaTypes";
import { previewKey } from "./previewCache";

const { mockedFs } = vi.hoisted(() => {
  return {
    mockedFs: {
      stat: vi.fn<(p: string) => Promise<Stats>>(),
      access: vi.fn(),
      readdir: vi.fn<(dir: string) => Promise<Dirent<string>[]>>(),
      mkdir: vi.fn<(file: string) => Promise<string>>(),
    },
  };
});

vi.mock("./generateVideoPreview", () => ({
  default: vi.fn(),
}));

vi.mock("./ffmpeg", () => ({
  hasFfmpeg: vi.fn().mockReturnValue(true),
}));

vi.mock("fs/promises", () => ({
  default: mockedFs,
}));

vi.mock("@/util/getVortexPath", () => ({
  default: vi.fn(() => "/tmp/vortex-temp"),
}));

const dirent = (name: string, file = true) => ({ name, isFile: () => file }) as unknown as Dirent;

describe("collectMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("only scans sources not specified in disabled sources", async () => {
    mockedFs.stat.mockResolvedValue({} as Stats);
    mockedFs.readdir.mockResolvedValue([dirent("someFile.png"), dirent("folder", false)]);

    const sources: Record<string, ResolvedGameMediaSource> = {
      sourceA: {
        name: "A",
        path: "A",
      },
      sourceB: {
        name: "B",
        path: "B",
      },
    };
    const disabledSources: string[] = ["sourceB"];

    const result = await collectMedia(sources, disabledSources, { showVideos: false });
    expect(mockedFs.readdir).toHaveBeenCalledWith("A", { withFileTypes: true });

    const resultSources = new Set(result.map((r) => r.sourceId));
    expect(resultSources).not.toContain("sourceB");
    expect(result.length).toEqual(1);
  });

  it("handles missing directories gracefully", async () => {
    mockedFs.stat.mockRejectedValue({ code: "ENOENT" });
    mockedFs.readdir.mockResolvedValue([dirent("someFile.png"), dirent("folder", false)]);

    const sources: Record<string, ResolvedGameMediaSource> = {
      sourceA: {
        name: "A",
        path: "A",
      },
    };

    const res = await collectMedia(sources, [], { showVideos: false });
    expect(res.length).toEqual(0);
  });

  it("selects only jpg/png/gif/bmp/mp4 files when no discoverFn is provided", async () => {
    mockedFs.stat.mockResolvedValue({} as Stats);
    mockedFs.readdir.mockResolvedValue([
      dirent("someFile.png"),
      dirent("anotherfile.jpg"),
      dirent("yetanotherfile.png"),
      dirent("video.mp4"),
      dirent("invalid.txt"),
      dirent("folder", false),
    ]);
    mockedFs.access.mockResolvedValue(undefined);

    const sources: Record<string, ResolvedGameMediaSource> = {
      sourceA: {
        name: "A",
        path: "A",
      },
    };

    const result = await collectMedia(sources, [], { showVideos: false });

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
      dirent("someFile-thumbnail.png"),
      dirent("anotherfile.jpg"),
      dirent("yetanotherfile-thumbnail.png"),
      dirent("video.mp4"),
    ]);
    mockedFs.access.mockResolvedValue(undefined);

    const filterFn = vi.fn((s: string) => !s.toLowerCase().includes("thumbnail"));

    const sources: Record<string, ResolvedGameMediaSource> = {
      sourceA: {
        name: "A",
        path: "A",
        filterFn,
      },
    };

    const result = await collectMedia(sources, [], { showVideos: true });
    expect(filterFn).toHaveBeenCalledTimes(4);
    expect(filterFn).toHaveBeenCalledWith("someFile-thumbnail.png");
    expect(result.map((r) => r.name)).toEqual(["anotherfile.jpg", "video.mp4"]);
  });

  it("returned items sorted by creation date", async () => {
    let statcounter = 1;
    mockedFs.stat.mockImplementation(async () => {
      const birthtime = new Date();
      birthtime.setDate(statcounter++);
      return Promise.resolve({
        birthtime,
      } as unknown as Stats);
    });
    mockedFs.readdir.mockResolvedValue([
      dirent("someFile.png"),
      dirent("anotherfile.jpg"),
      dirent("yetanotherfile.png"),
    ]);

    const sources: Record<string, ResolvedGameMediaSource> = {
      sourceA: {
        name: "A",
        path: "A",
      },
    };

    const result = await collectMedia(sources, [], { showVideos: false });
    expect(result.length).toBeGreaterThan(0);
    const date0 = result[0].createdAt;
    const date1 = result[1].createdAt;
    expect(date0.getTime() > date1.getTime()).toEqual(true);
  });

  it("if a source has a discoverFn it should be called", async () => {
    mockedFs.stat.mockResolvedValue({} as unknown as Stats);
    mockedFs.readdir.mockResolvedValue([
      dirent("someFile-thumbail.png"),
      dirent("anotherfile.jpg"),
      dirent("video.mp4"),
      dirent("invalid-thumbnail.png"),
    ]);

    const discoverFn = vi.fn(async () => Promise.resolve([]));

    const sources: Record<string, ResolvedGameMediaSource> = {
      sourceA: {
        name: "A",
        path: "A",
        discoverFn,
      },
    };

    await collectMedia(sources, [], { showVideos: false });
    expect(discoverFn).toHaveBeenNthCalledWith(1, "A");
  });

  it("only calls generateVideoPreview for mp4s", async () => {
    const MTIME = new Date("2024-01-02");
    const videoStats = {
      size: 1234,
      birthtime: new Date("2024-01-01"),
      mtime: MTIME,
      mtimeMs: MTIME.getTime(),
    } as Stats;

    mockedFs.stat.mockResolvedValue(videoStats);
    mockedFs.readdir.mockResolvedValue([dirent("someFile.png"), dirent("video.mp4")]);

    const expectedKey = previewKey(
      path.join("/tmp/media", "video.mp4"),
      videoStats.mtimeMs,
      videoStats.size,
    );

    await collectMedia(
      {
        src: {
          name: "Test",
          path: "/tmp/media",
        },
      },
      [],
      { showVideos: true },
    );

    expect(generateVideoPreview).toHaveBeenCalledWith(
      path.join("/tmp/media", "video.mp4"),
      expectedKey,
    );
    expect(generateVideoPreview).toHaveBeenCalledTimes(1);
  });
});
