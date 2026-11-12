import type { GameFolderFileReport } from "@vortex/shared/ipc";
import { describe, expect, it } from "vitest";

import { pathKey, type IBaseline } from "./baseline";
import type { IListing } from "./listing";
import { reconcile, reportedFiles } from "./reconcile";
import type { IVerification } from "./verify";

const unknown = (relPath: string, size = 10): GameFolderFileReport => ({
  relPath,
  kind: "unknown",
  size,
});

describe("reportedFiles", () => {
  it("sends modified and missing files in full, with forward slashes", () => {
    const { files } = reportedFiles(
      [
        { relPath: "Data\\a.bsa", kind: "modified", size: 1, detectedBy: "size", fromBackup: true },
        { relPath: "Data\\b.bsa", kind: "modified", size: 1, detectedBy: "sampled_chunk" },
        { relPath: "Data\\c.bsa", kind: "missing", size: 1 },
        { relPath: "Data\\d.bsa", kind: "verified", size: 1 },
        { relPath: "Data\\e.bsa", kind: "size_matched", size: 1 },
      ],
      0,
      Math.random,
    );
    expect(files).toEqual([
      { path: "Data/a.bsa", status: "modified", detectedBy: "size", fromBackup: true },
      { path: "Data/b.bsa", status: "modified", detectedBy: "sampled_chunk" },
      { path: "Data/c.bsa", status: "missing" },
    ]);
  });

  it("caps unknown paths and totals every unknown file by folder", () => {
    const report = reportedFiles(
      [
        unknown("Mods\\A\\About\\About.xml"),
        unknown("Mods\\A\\Textures\\t.png", 30),
        unknown("Mods\\B\\b.dll", 20),
        unknown("imgui.ini", 5),
      ],
      2,
      () => 0,
    );
    expect(report.files.filter((file) => file.status === "unknown")).toHaveLength(2);
    expect(report.unknownTruncated).toBe(true);
    expect(report.unknownByFolder).toEqual([
      { folder: "Mods/A", files: 2, bytes: 40 },
      { folder: "Mods/B", files: 1, bytes: 20 },
      { folder: ".", files: 1, bytes: 5 },
    ]);
  });

  it("isn't truncated when every unknown path fits", () => {
    const report = reportedFiles([unknown("a.txt"), unknown("b.txt")], 2, () => 0);
    expect(report.unknownTruncated).toBe(false);
    expect(report.files).toHaveLength(2);
  });
});

/** A listing of the given files (relative paths, `/` separators); `deployed` maps paths to deploy times. */
function listingOf(paths: string[], deployed: Record<string, number> = {}): IListing {
  return {
    files: new Map(
      paths.map((relPath) => [pathKey(relPath), { relPath, size: 10, mtimeMs: 1_000 }]),
    ),
    deployed: new Map(Object.entries(deployed).map(([relPath, time]) => [pathKey(relPath), time])),
    hasDeployment: Object.keys(deployed).length > 0,
    filesWalked: paths.length,
  };
}

const NO_STEAM: IBaseline = { files: new Map(), manifestCreatedAt: {} };
const NO_VERIFICATION: IVerification = {
  status: { status: "checked", reason: null },
  outcomes: new Map(),
  hashSample: { files: 0, capped: false },
  bytesRead: 0,
};

const flagged = (paths: string[], deployed?: Record<string, number>) => {
  const { counts, files } = reconcile(NO_STEAM, listingOf(paths, deployed), NO_VERIFICATION, false);
  return {
    counts,
    byPath: Object.fromEntries(files.map((file) => [file.relPath, file])),
  };
};

describe("reconcile: unknown files in Vortex folders", () => {
  it("flags unknown files in a marked folder and below it", () => {
    const { byPath, counts } = flagged([
      "bin/x64/plugins/cyber_engine_tweaks/__folder_managed_by_vortex",
      "bin/x64/plugins/cyber_engine_tweaks/mods/AppearanceMenu/db.sqlite3",
      "bin/x64/plugins/cyber_engine_tweaks/cyber_engine_tweaks.log",
      "bin/x64/plugins/other.log",
      "imgui.ini",
    ]);
    expect(
      byPath["bin/x64/plugins/cyber_engine_tweaks/mods/AppearanceMenu/db.sqlite3"],
    ).toMatchObject({
      kind: "unknown",
      inVortexFolder: true,
    });
    expect(
      byPath["bin/x64/plugins/cyber_engine_tweaks/cyber_engine_tweaks.log"]?.inVortexFolder,
    ).toBe(true);
    expect(byPath["bin/x64/plugins/other.log"]?.inVortexFolder).toBeUndefined();
    expect(byPath["imgui.ini"]?.inVortexFolder).toBeUndefined();
    expect(counts.unknown.files).toBe(4);
    expect(counts.unknownInVortexFolder.files).toBe(2);
    expect(byPath["bin/x64/plugins/cyber_engine_tweaks/__folder_managed_by_vortex"]?.kind).toBe(
      "vortex",
    );
  });

  it("recognises the old and the non-Windows marker names", () => {
    const { byPath } = flagged([
      "r6/scripts/__delete_if_empty",
      "r6/scripts/mod/log.txt",
      "red4ext/.__folder_managed_by_vortex",
      "red4ext/logs/red4ext.log",
    ]);
    expect(byPath["r6/scripts/mod/log.txt"]?.inVortexFolder).toBe(true);
    expect(byPath["red4ext/logs/red4ext.log"]?.inVortexFolder).toBe(true);
  });

  it("keeps deployed files as Vortex files", () => {
    const { byPath } = flagged(["mods/__folder_managed_by_vortex", "mods/a.archive"], {
      "mods/a.archive": 1_000,
    });
    expect(byPath["mods/a.archive"]?.kind).toBe("vortex");
  });

  it("sends the flag with the unknown path", () => {
    const { files } = reportedFiles(
      [
        { relPath: "mods/log.txt", kind: "unknown", size: 1, inVortexFolder: true },
        { relPath: "imgui.ini", kind: "unknown", size: 1 },
      ],
      10,
      Math.random,
    );
    expect(files).toEqual([
      { path: "imgui.ini", status: "unknown" },
      { path: "mods/log.txt", status: "unknown", inVortexFolder: true },
    ]);
  });
});
