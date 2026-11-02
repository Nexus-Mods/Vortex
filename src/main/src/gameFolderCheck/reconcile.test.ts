import type { GameFolderFileReport } from "@vortex/shared/ipc";
import { describe, expect, it } from "vitest";

import { reportedFiles } from "./reconcile";

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
