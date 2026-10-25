import type { FolderCheckFile, FolderCheckResult } from "@vortex/shared/ipc";
import { describe, expect, it } from "vitest";

import { summarise } from "./summarise";

const file = (
  relPath: string,
  size: number,
  extra: Partial<FolderCheckFile> = {},
): FolderCheckFile => ({
  relPath,
  size,
  mtimeMs: 0,
  bucket: "unknown",
  ...extra,
});

const resultWith = (files: FolderCheckFile[], missing = 0): FolderCheckResult => ({
  checkedAt: 0,
  input: { appId: 1, buildId: 1, steamPath: "", gamePath: "", depots: [] },
  files,
  missing: Array.from({ length: missing }, (_, i) => ({ relPath: `m${i}`, size: 1 })),
  unreadable: [],
  baseFilesWithBackup: 0,
});

describe("summarise", () => {
  it("counts buckets and flags", () => {
    const summary = summarise(
      resultWith(
        [
          file("SkyrimSE.exe", 100, { bucket: "game", modified: true }),
          file("Data\\Skyrim.esm", 50, { bucket: "game" }),
          file("Data\\SKSE\\a.json", 7, { bucket: "vortex", changedSinceDeployed: true }),
          file("Data\\SKSE\\b.dll", 3, { bucket: "vortex" }),
          file("debug.log", 1),
        ],
        2,
      ),
    );
    expect(summary.counts).toEqual({
      game: { files: 2, bytes: 150 },
      vortex: { files: 2, bytes: 10 },
      unknown: { files: 1, bytes: 1 },
    });
    expect(summary.modified).toBe(1);
    expect(summary.missing).toBe(2);
    expect(summary.changedSinceDeployed).toEqual({ files: 1, bytes: 7 });
  });

  it("groups unknown files by folder", () => {
    const summary = summarise(
      resultWith([
        file("r6\\cache\\final.redscripts.modded", 21),
        file("bin\\x64\\plugins\\cyber_engine_tweaks\\mods\\A\\db.sqlite3", 2),
        file("bin\\x64\\plugins\\cyber_engine_tweaks\\mods\\B\\db.sqlite3", 3),
        file("imgui.ini", 1),
        file("SkyrimSE.exe", 100, { bucket: "game" }),
      ]),
    );
    expect(summary.unknownGroups.map((g) => [g.folder, g.files.length, g.bytes])).toEqual([
      ["bin\\x64\\plugins", 2, 5],
      ["r6\\cache", 1, 21],
      ["imgui.ini", 1, 1],
    ]);
  });
});
