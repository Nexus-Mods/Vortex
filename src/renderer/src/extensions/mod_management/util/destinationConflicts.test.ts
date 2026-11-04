import { relativePath } from "@nexusmods/paths";
import { VortexModStagingFolder } from "@vortex/shared";
import { type InMemoryFS, QualifiedPath } from "@vortex/shared/filesystem";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installInMemoryFS } from "@/test-utils/fsApi";

import type { IDeploymentManifest } from "../types/IDeploymentManifest";
import type { IDeployedFile } from "../types/IDeploymentMethod";
import {
  classifyDestinationFiles,
  cachedGameFiles,
  createDirectoryReader,
  deployedFiles,
  existingGameFiles,
  type IDeployedFiles,
} from "./destinationConflicts";

// --- Helpers ---

const manifest = (
  files: Array<Pick<IDeployedFile, "relPath" | "source"> & Partial<IDeployedFile>>,
): IDeploymentManifest => ({
  version: 1,
  instance: "instance",
  files: files.map((file) => ({ time: 0, ...file })),
});

const folder = VortexModStagingFolder;

const paths = (...values: string[]) => values.map((value) => relativePath(value));

describe("deployedFiles", () => {
  it("maps each other mod's file to the staging folder of the mod that deployed it", () => {
    const { byOtherMods } = deployedFiles(
      manifest([
        { relPath: "Data/a.esp", source: "mod-a" },
        { relPath: "b.dll", source: "mod-b" },
      ]),
      [],
    );

    expect(byOtherMods.get("data/a.esp")).toBe("mod-a");
    expect(byOtherMods.get("b.dll")).toBe("mod-b");
  });

  it("keeps the files of the staging folders given as the mod's own apart", () => {
    const { byOtherMods, byOwnMod } = deployedFiles(
      manifest([
        { relPath: "new.txt", source: "new-mod" },
        { relPath: "Old.txt", source: "old-mod" },
        { relPath: "other.txt", source: "other-mod" },
      ]),
      [folder("new-mod"), folder("old-mod")],
    );

    expect([...byOtherMods.keys()]).toEqual(["other.txt"]);
    expect(byOwnMod).toEqual(new Set(["new.txt", "old.txt"]));
  });

  it("keys paths without regard to case and with forward slashes", () => {
    const { byOtherMods } = deployedFiles(
      manifest([{ relPath: "Data\\Textures\\Stone.DDS", source: "mod-a" }]),
      [],
    );

    expect(byOtherMods.has("data/textures/stone.dds")).toBe(true);
  });

  it("puts a file's output folder in front of its path", () => {
    const { byOtherMods } = deployedFiles(
      manifest([{ relPath: "a.txt", source: "mod-a", target: "sub" }]),
      [],
    );

    expect(byOtherMods.has("sub/a.txt")).toBe(true);
    expect(byOtherMods.has("a.txt")).toBe(false);
  });

  it("keeps the entry listed last for a path", () => {
    const { byOtherMods } = deployedFiles(
      manifest([
        { relPath: "a.txt", source: "first" },
        { relPath: "A.txt", source: "second" },
      ]),
      [],
    );

    expect(byOtherMods.get("a.txt")).toBe("second");
  });

  it("keeps the entry listed last for a path, between the mod's own and another's", () => {
    const own = [folder("own")];

    const ownLast = deployedFiles(
      manifest([
        { relPath: "a.txt", source: "other" },
        { relPath: "a.txt", source: "own" },
      ]),
      own,
    );
    const otherLast = deployedFiles(
      manifest([
        { relPath: "a.txt", source: "own" },
        { relPath: "a.txt", source: "other" },
      ]),
      own,
    );

    expect(ownLast).toEqual({ byOtherMods: new Map(), byOwnMod: new Set(["a.txt"]) });
    expect(otherLast).toEqual({
      byOtherMods: new Map([["a.txt", "other"]]),
      byOwnMod: new Set(),
    });
  });

  it("skips entries without a source or with a path that isn't relative to the game root", () => {
    const { byOtherMods, byOwnMod } = deployedFiles(
      manifest([
        { relPath: "no-source.txt", source: "" },
        { relPath: "../outside.txt", source: "mod-a" },
        { relPath: "C:\\drive.txt", source: "own" },
        { relPath: "ok.txt", source: "mod-a" },
      ]),
      [folder("own")],
    );

    expect([...byOtherMods.keys()]).toEqual(["ok.txt"]);
    expect(byOwnMod.size).toBe(0);
  });

  it("gives nothing for an empty manifest", () => {
    expect(deployedFiles(manifest([]), [])).toEqual({
      byOtherMods: new Map(),
      byOwnMod: new Set(),
    });
  });
});

describe("existingGameFiles", () => {
  const root = QualifiedPath.fromNative("/game");
  const text = { type: "text", data: "x" } as const;

  let restore: () => void;
  let fs: InMemoryFS;

  // A file added after a directory was read, which only a new read of it finds.
  const addLater = (path: QualifiedPath) => fs.writeFile(path, new TextEncoder().encode("x"));

  beforeEach(async () => {
    const installed = installInMemoryFS((builder) => {
      builder.file(root.join("game.exe"), text);
      builder.file(root.join("bin"), text);
      builder.file(root.join("Data", "Game.esm"), text);
      builder.file(root.join("Data", "Textures", "stone.dds"), text);
    });

    await installed.fs.createDirectory(root.join("Data", "Empty"));

    restore = installed.restore;
    fs = installed.fs;
  });

  afterEach(() => {
    restore();
  });

  it("finds the files that exist at the final paths' directories", async () => {
    const existing = await existingGameFiles(
      root,
      paths("Data/Game.esm", "Data/Mod.esp", "game.exe"),
    );

    expect(existing).toEqual({
      files: new Set(["data/game.esm", "game.exe", "bin"]),
      hasFailed: false,
    });
  });

  it("includes files that aren't one of the final paths", async () => {
    const { files } = await existingGameFiles(root, paths("Data/Mod.esp"));

    expect(files.has("data/game.esm")).toBe(true);
  });

  it("doesn't count directories as files", async () => {
    const { files } = await existingGameFiles(root, paths("Data/Mod.esp"));

    expect(files.has("data/textures")).toBe(false);
    expect(files.has("data/empty")).toBe(false);
  });

  it("finds nothing in a directory that doesn't exist, which isn't a failure", async () => {
    expect(await existingGameFiles(root, paths("Missing/a.txt"))).toEqual({
      files: new Set(),
      hasFailed: false,
    });
  });

  it("finds nothing for no files", async () => {
    expect(await existingGameFiles(root, [])).toEqual({ files: new Set(), hasFailed: false });
  });

  it("knows a directory it has read whatever the case of its name", async () => {
    const reader = createDirectoryReader();

    await existingGameFiles(root, paths("Data/a.txt"), reader);
    await addLater(root.join("Data", "New.esp"));

    const { files } = await existingGameFiles(root, paths("DATA/b.txt", "data/c.txt"), reader);

    expect(files).toEqual(new Set(["data/game.esm"]));
  });

  it("still finds the files of the other directories when one can't be read", async () => {
    // the game has a file where the mod has a directory, which can't be read as one
    expect(await existingGameFiles(root, paths("bin/mod.dll", "Data/Mod.esp"))).toEqual({
      files: new Set(["data/game.esm"]),
      hasFailed: true,
    });
  });

  it("doesn't read a directory the reader has read again, but does one it hasn't", async () => {
    const reader = createDirectoryReader();

    await existingGameFiles(root, paths("Data/a.txt"), reader);
    await addLater(root.join("Data", "New.esp"));
    await addLater(root.join("new.dll"));

    const { files } = await existingGameFiles(root, paths("data/b.txt", "c.txt"), reader);

    // Data as it was first read; the game root, read only now, with what was added
    expect(files).toEqual(new Set(["data/game.esm", "game.exe", "bin", "new.dll"]));
  });

  it("reads a directory that failed again the next time", async () => {
    const reader = createDirectoryReader();

    expect((await existingGameFiles(root, paths("bin/mod.dll"), reader)).hasFailed).toBe(true);

    // the file in the way is replaced by a directory, which can be read
    await fs.delete(root.join("bin"));
    await fs.createDirectory(root.join("bin"));
    await addLater(root.join("bin", "game.dll"));

    expect(await existingGameFiles(root, paths("bin/mod.dll"), reader)).toEqual({
      files: new Set(["bin/game.dll"]),
      hasFailed: false,
    });
  });

  it("finishes every read queued behind its limit, across overlapping calls", async () => {
    // one read at a time, so all but the first wait their turn
    const reader = createDirectoryReader(1);

    const [first, second] = await Promise.all([
      existingGameFiles(root, paths("a.txt", "Data/a.txt", "Missing/a.txt"), reader),
      existingGameFiles(
        root,
        paths("Data/Textures/a.dds", "Data/Empty/a.txt", "bin/a.dll"),
        reader,
      ),
    ]);

    expect(first).toEqual({
      files: new Set(["game.exe", "bin", "data/game.esm"]),
      hasFailed: false,
    });
    // `bin` is a file, so it can't be read as a directory
    expect(second).toEqual({ files: new Set(["data/textures/stone.dds"]), hasFailed: true });
  });

  // on the same game folder, as it only knows what `existingGameFiles` read
  describe("cachedGameFiles", () => {
    it("knows nothing before the directories are read", () => {
      expect(cachedGameFiles(paths("Data/a.txt"), createDirectoryReader())).toBeUndefined();
    });

    it("finds what was found once every directory has been read", async () => {
      const reader = createDirectoryReader();
      const finalPaths = paths("Data/Game.esm", "Data/Mod.esp", "game.exe");

      const found = await existingGameFiles(root, finalPaths, reader);

      expect(cachedGameFiles(finalPaths, reader)).toEqual(found);
    });

    it("knows nothing while one of the directories is still to be read", async () => {
      const reader = createDirectoryReader();

      await existingGameFiles(root, paths("Data/a.txt"), reader);

      expect(cachedGameFiles(paths("Data/a.txt", "game.exe"), reader)).toBeUndefined();
    });

    it("knows a directory it has read whatever the case of its name", async () => {
      const reader = createDirectoryReader();

      await existingGameFiles(root, paths("Data/a.txt"), reader);

      expect(cachedGameFiles(paths("DATA/b.txt"), reader)).toEqual({
        files: new Set(["data/game.esm"]),
        hasFailed: false,
      });
    });

    it("knows nothing for a directory whose read failed, so it's read again", async () => {
      const reader = createDirectoryReader();

      expect((await existingGameFiles(root, paths("bin/mod.dll"), reader)).hasFailed).toBe(true);

      expect(cachedGameFiles(paths("bin/mod.dll"), reader)).toBeUndefined();
    });
  });
});

describe("classifyDestinationFiles", () => {
  const deployed: IDeployedFiles = {
    byOtherMods: new Map([["data/other.esp", folder("other-mod")]]),
    byOwnMod: new Set(["data/own.esp"]),
  };
  // the mod's own deployed file is on disk too, as on a reinstall
  const existing = new Set(["data/game.esm", "data/other.esp", "data/own.esp"]);

  it("marks a path nothing is at as new", () => {
    expect(classifyDestinationFiles(paths("Data/New.esp"), existing, deployed)).toEqual([
      { path: "Data/New.esp", status: { kind: "new" } },
    ]);
  });

  it("marks a path a game file is at as replacing it", () => {
    expect(classifyDestinationFiles(paths("Data/Game.esm"), existing, deployed)).toEqual([
      { path: "Data/Game.esm", status: { kind: "replacesGameFile" } },
    ]);
  });

  it("marks a path another mod deployed to as conflicting, with that mod", () => {
    expect(classifyDestinationFiles(paths("Data/Other.esp"), existing, deployed)).toEqual([
      {
        path: "Data/Other.esp",
        status: { kind: "conflictsWithMod", stagingFolder: "other-mod" },
      },
    ]);
  });

  it("counts a file another mod deployed as that mod's, not the game's", () => {
    const [result] = classifyDestinationFiles(paths("Data/Other.esp"), existing, deployed);

    expect(result?.status.kind).toBe("conflictsWithMod");
  });

  it("marks a path the mod itself deployed to as replacing its own file, not the game's", () => {
    expect(classifyDestinationFiles(paths("Data/Own.esp"), existing, deployed)).toEqual([
      { path: "Data/Own.esp", status: { kind: "replacesOwnFile" } },
    ]);
  });

  it("compares without regard to case and keeps the path as given", () => {
    const [result] = classifyDestinationFiles(paths("DATA/GAME.ESM"), existing, deployed);

    expect(result).toEqual({ path: "DATA/GAME.ESM", status: { kind: "replacesGameFile" } });
  });

  it("keeps the order of the paths", () => {
    const results = classifyDestinationFiles(
      paths("Data/New.esp", "Data/Game.esm", "Data/Other.esp", "Data/Own.esp"),
      existing,
      deployed,
    );

    expect(results.map(({ status }) => status.kind)).toEqual([
      "new",
      "replacesGameFile",
      "conflictsWithMod",
      "replacesOwnFile",
    ]);
  });

  it("gives nothing for no paths", () => {
    expect(classifyDestinationFiles([], existing, deployed)).toEqual([]);
  });
});
