import type * as nodeFs from "fs";

import { describe, it, expect, vi, beforeEach } from "vitest";

const devices: Record<string, number> = {};

vi.mock("fs", async (importOriginal) => ({
  ...(await importOriginal<typeof nodeFs>()),
  existsSync: (filePath: string) => devices[filePath] !== undefined,
  statSync: (filePath: string) => ({ dev: devices[filePath] }),
}));

vi.mock("winapi-bindings", () => ({
  GetVolumePathName: (input: string) => `volume of ${input}`,
}));

import { getVolumePath } from "./getVolumePath";

const platform = process.platform;

function setPlatform(value: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { value });
}

describe("getVolumePath", () => {
  beforeEach(() => {
    setPlatform(platform);
    for (const key of Object.keys(devices)) delete devices[key];
    Object.assign(devices, {
      "/": 1,
      "/mnt": 1,
      "/mnt/data": 2,
      "/mnt/data/games": 2,
      "/mnt/data/games/foo": 2,
    });
  });

  it("uses winapi on windows", () => {
    setPlatform("win32");
    expect(getVolumePath("C:\\games\\foo")).toBe("volume of C:\\games\\foo");
  });

  it("returns the mount point of the path", () => {
    setPlatform("linux");
    expect(getVolumePath("/mnt/data/games/foo")).toBe("/mnt/data");
  });

  it("returns the root for paths on the root device", () => {
    setPlatform("linux");
    expect(getVolumePath("/mnt")).toBe("/");
  });

  it("resolves missing paths through their closest existing parent", () => {
    setPlatform("linux");
    expect(getVolumePath("/mnt/data/games/foo/mods/bar")).toBe("/mnt/data");
  });
});
