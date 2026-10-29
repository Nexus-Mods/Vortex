import { relativePath } from "@nexusmods/paths";
import { VortexModStagingFolder } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installInMemoryFS } from "@/test-utils/fsApi";

import type { IDeploymentManifest } from "../types/IDeploymentManifest";
import type { IDeployedFile } from "../types/IDeploymentMethod";
import {
  classifyDestinationFiles,
  deployedByOtherMods,
  existingGameFiles,
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

describe("deployedByOtherMods", () => {
  it("maps each file to the staging folder of the mod that deployed it", () => {
    const deployed = deployedByOtherMods(
      manifest([
        { relPath: "Data/a.esp", source: "mod-a" },
        { relPath: "b.dll", source: "mod-b" },
      ]),
      [],
    );

    expect(deployed.get("data/a.esp")).toBe("mod-a");
    expect(deployed.get("b.dll")).toBe("mod-b");
  });

  it("leaves out the files of the staging folders given as the mod's own", () => {
    const deployed = deployedByOtherMods(
      manifest([
        { relPath: "new.txt", source: "new-mod" },
        { relPath: "old.txt", source: "old-mod" },
        { relPath: "other.txt", source: "other-mod" },
      ]),
      [folder("new-mod"), folder("old-mod")],
    );

    expect([...deployed.keys()]).toEqual(["other.txt"]);
  });

  it("keys paths without regard to case and with forward slashes", () => {
    const deployed = deployedByOtherMods(
      manifest([{ relPath: "Data\\Textures\\Stone.DDS", source: "mod-a" }]),
      [],
    );

    expect(deployed.has("data/textures/stone.dds")).toBe(true);
  });

  it("puts a file's output folder in front of its path", () => {
    const deployed = deployedByOtherMods(
      manifest([{ relPath: "a.txt", source: "mod-a", target: "sub" }]),
      [],
    );

    expect(deployed.has("sub/a.txt")).toBe(true);
    expect(deployed.has("a.txt")).toBe(false);
  });

  it("keeps the mod that deployed a path last", () => {
    const deployed = deployedByOtherMods(
      manifest([
        { relPath: "a.txt", source: "first" },
        { relPath: "A.txt", source: "second" },
      ]),
      [],
    );

    expect(deployed.get("a.txt")).toBe("second");
  });

  it("skips entries without a source or with a path that isn't relative to the game root", () => {
    const deployed = deployedByOtherMods(
      manifest([
        { relPath: "no-source.txt", source: "" },
        { relPath: "../outside.txt", source: "mod-a" },
        { relPath: "C:\\drive.txt", source: "mod-a" },
        { relPath: "ok.txt", source: "mod-a" },
      ]),
      [],
    );

    expect([...deployed.keys()]).toEqual(["ok.txt"]);
  });

  it("gives nothing for an empty manifest", () => {
    expect(deployedByOtherMods(manifest([]), []).size).toBe(0);
  });
});

describe("existingGameFiles", () => {
  const root = QualifiedPath.fromNative("/game");
  const text = { type: "text", data: "x" } as const;

  let restore: () => void;
  let enumerate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    const installed = installInMemoryFS((builder) => {
      builder.file(root.join("game.exe"), text);
      builder.file(root.join("Data", "Game.esm"), text);
      builder.file(root.join("Data", "Textures", "stone.dds"), text);
    });

    await installed.fs.createDirectory(root.join("Data", "Empty"));

    restore = installed.restore;
    enumerate = vi.spyOn(window.api.fs, "enumerateDirectory");
  });

  afterEach(() => {
    restore();
  });

  it("finds the files that exist at the final paths' directories", async () => {
    const existing = await existingGameFiles(
      root,
      paths("Data/Game.esm", "Data/Mod.esp", "game.exe"),
    );

    expect(existing).toEqual(new Set(["data/game.esm", "game.exe"]));
  });

  it("includes files that aren't one of the final paths", async () => {
    const existing = await existingGameFiles(root, paths("Data/Mod.esp"));

    expect(existing.has("data/game.esm")).toBe(true);
  });

  it("doesn't count directories as files", async () => {
    const existing = await existingGameFiles(root, paths("Data/Mod.esp"));

    expect(existing.has("data/textures")).toBe(false);
    expect(existing.has("data/empty")).toBe(false);
  });

  it("finds nothing in a directory that doesn't exist", async () => {
    expect(await existingGameFiles(root, paths("Missing/a.txt"))).toEqual(new Set());
  });

  it("finds nothing for no files", async () => {
    expect(await existingGameFiles(root, [])).toEqual(new Set());
  });

  it("reads each directory once, whatever the case of its name", async () => {
    await existingGameFiles(root, paths("Data/a.txt", "Data/b.txt", "data/c.txt", "d.txt"));

    expect(enumerate).toHaveBeenCalledTimes(2);
  });
});

describe("classifyDestinationFiles", () => {
  const deployed = new Map([["data/other.esp", folder("other-mod")]]);
  const existing = new Set(["data/game.esm", "data/other.esp"]);

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

  it("compares without regard to case and keeps the path as given", () => {
    const [result] = classifyDestinationFiles(paths("DATA/GAME.ESM"), existing, deployed);

    expect(result).toEqual({ path: "DATA/GAME.ESM", status: { kind: "replacesGameFile" } });
  });

  it("keeps the order of the paths", () => {
    const results = classifyDestinationFiles(
      paths("Data/New.esp", "Data/Game.esm", "Data/Other.esp"),
      existing,
      deployed,
    );

    expect(results.map(({ status }) => status.kind)).toEqual([
      "new",
      "replacesGameFile",
      "conflictsWithMod",
    ]);
  });

  it("gives nothing for no paths", () => {
    expect(classifyDestinationFiles([], existing, deployed)).toEqual([]);
  });
});
