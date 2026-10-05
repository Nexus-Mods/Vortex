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

describe("getVolumePath", () => {
  beforeEach(() => {
    for (const key of Object.keys(devices)) delete devices[key];
    Object.assign(devices, {
      "/": 1,
      "/mnt": 1,
      "/mnt/data": 2,
      "/mnt/data/games": 2,
      "/mnt/data/games/foo": 2,
    });
  });

  it.runIf(process.platform === "win32")("uses winapi on windows", () => {
    expect(getVolumePath("C:\\games\\foo")).toBe("volume of C:\\games\\foo");
  });

  it.skipIf(process.platform === "win32")("returns the mount point of the path", () => {
    expect(getVolumePath("/mnt/data/games/foo")).toBe("/mnt/data");
  });

  it.skipIf(process.platform === "win32")("returns the root for paths on the root device", () => {
    expect(getVolumePath("/mnt")).toBe("/");
  });

  it.skipIf(process.platform === "win32")(
    "resolves missing paths through their closest existing parent",
    () => {
      expect(getVolumePath("/mnt/data/games/foo/mods/bar")).toBe("/mnt/data");
    },
  );
});
