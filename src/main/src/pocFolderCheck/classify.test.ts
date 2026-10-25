import { describe, expect, it } from "vitest";

import { classify, type IDiskFile, mergeDepotFiles } from "./classify";
import type { IDepotFile, IDepotManifest } from "./depotManifest";

const SHA1 = "2f784a183f884067a9a41338664b55f6dc198a48";

const disk = (relPath: string, size = 10, mtimeMs = 1_000_000, isSymlink = false): IDiskFile => ({
  relPath,
  size,
  mtimeMs,
  isSymlink,
});

const baseFile = (
  name: string,
  size = 10,
  flags = 0,
  sha1 = SHA1,
  linkTarget = "",
): IDepotFile => ({
  name,
  size,
  flags,
  sha1,
  linkTarget,
  chunks: [],
});

const baseOf = (...files: IDepotFile[]) =>
  mergeDepotFiles([{ depotId: 1, manifestId: "1", filenamesEncrypted: false, files }]);

describe("classify", () => {
  it("puts deployed files in vortex", () => {
    const result = classify([disk("Data\\SKSE\\Plugins\\a.bin")], baseOf(), [
      { relPath: "Data\\SKSE\\Plugins\\a.bin", time: 1_000_000 },
    ]);
    expect(result.files).toEqual([
      { relPath: "Data\\SKSE\\Plugins\\a.bin", size: 10, mtimeMs: 1_000_000, bucket: "vortex" },
    ]);
  });

  it("flags deployed files rewritten since deployment", () => {
    const deployed = [{ relPath: "Data\\SKSE\\Plugins\\a.bin", time: 1_000_000 }];
    const rewritten = classify(
      [disk("Data\\SKSE\\Plugins\\a.bin", 10, 1_005_000)],
      baseOf(),
      deployed,
    );
    expect(rewritten.files[0]?.bucket).toBe("vortex");
    expect(rewritten.files[0]?.changedSinceDeployed).toBe(true);

    const symlink = classify(
      [disk("Data\\SKSE\\Plugins\\a.bin", 10, 1_005_000, true)],
      baseOf(),
      deployed,
    );
    expect(symlink.files[0]?.changedSinceDeployed).toBeUndefined();
  });

  it("treats Vortex's own files as vortex", () => {
    const result = classify(
      [
        disk("Data\\vortex.deployment.json"),
        disk("bin\\x64\\plugins\\__folder_managed_by_vortex"),
        disk("SkyrimSE.exe.vortex_backup"),
      ],
      baseOf(),
      [],
    );
    expect(result.files.map((f) => f.bucket)).toEqual(["vortex", "vortex", "vortex"]);
  });

  it("matches base files ignoring case and separators", () => {
    const result = classify([disk("data/skyrim.esm")], baseOf(baseFile("Data\\Skyrim.esm")), []);
    expect(result.files).toEqual([
      { relPath: "data/skyrim.esm", size: 10, mtimeMs: 1_000_000, bucket: "game" },
    ]);
    expect(result.missing).toEqual([]);
  });

  it("marks size changes as modified without hashing", () => {
    const result = classify([disk("SkyrimSE.exe", 11)], baseOf(baseFile("SkyrimSE.exe", 10)), []);
    expect(result.files[0]).toMatchObject({ bucket: "game", modified: true });
    expect(result.toHash).toEqual([]);
  });

  it("queues same-size base files for hashing", () => {
    const result = classify([disk("SkyrimSE.exe", 10)], baseOf(baseFile("SkyrimSE.exe", 10)), []);
    expect(result.files[0]?.modified).toBeUndefined();
    expect(result.toHash).toEqual([{ relPath: "SkyrimSE.exe", sha1: SHA1, size: 10, chunks: [] }]);
  });

  it("never marks user config files modified", () => {
    for (const flags of [1, 2, 512]) {
      const result = classify(
        [disk("Skyrim.ini", 99)],
        baseOf(baseFile("Skyrim.ini", 10, flags)),
        [],
      );
      expect(result.files[0]?.bucket).toBe("game");
      expect(result.files[0]?.modified).toBeUndefined();
      expect(result.toHash).toEqual([]);
    }

    const linked = classify(
      [disk("link.dll", 10)],
      baseOf(baseFile("link.dll", 10, 0, SHA1, "target.dll")),
      [],
    );
    expect(linked.toHash).toEqual([]);
  });

  it("reports missing base files", () => {
    const result = classify([], baseOf(baseFile("Data\\Update.esm", 42)), []);
    expect(result.missing).toEqual([{ relPath: "Data\\Update.esm", size: 42 }]);
  });

  it("counts base files linked over by Vortex", () => {
    const result = classify(
      [disk("SkyrimSE.exe"), disk("SkyrimSE.exe.vortex_backup")],
      baseOf(baseFile("SkyrimSE.exe")),
      [{ relPath: "SkyrimSE.exe", time: 1_000_000 }],
    );
    expect(result.baseFilesWithBackup).toBe(1);
    expect(result.files.map((f) => f.bucket)).toEqual(["vortex", "vortex"]);
    expect(result.missing).toEqual([]);
    expect(result.toHash).toEqual([]);
  });

  it("puts everything else in unknown", () => {
    const result = classify(
      [disk("Data\\SSEEdit\\SSEEdit.exe")],
      baseOf(baseFile("SkyrimSE.exe")),
      [],
    );
    expect(result.files[0]?.bucket).toBe("unknown");
  });
});

describe("mergeDepotFiles", () => {
  it("later depot wins and directories are dropped", () => {
    const first: IDepotManifest = {
      depotId: 1,
      manifestId: "1",
      filenamesEncrypted: false,
      files: [baseFile("Data\\Skyrim.esm", 10), baseFile("Data", 0, 64)],
    };
    const second: IDepotManifest = {
      depotId: 2,
      manifestId: "2",
      filenamesEncrypted: false,
      files: [baseFile("data\\skyrim.esm", 20)],
    };
    const merged = mergeDepotFiles([first, second]);
    expect([...merged.keys()]).toEqual(["data\\skyrim.esm"]);
    expect(merged.get("data\\skyrim.esm")?.size).toBe(20);
  });
});
