import * as path from "node:path";

import { DiskEntryKind } from "@nexusmods/mod-pipeline";
import { ChaosFS, QualifiedPath } from "@vortex/shared/filesystem";
import { afterEach, describe, expect, test } from "vitest";

import { installInMemoryFS, type InstalledInMemoryFS } from "../../../test-utils/fsApi";
import { scanDeploymentTargets } from "./diskScan";

const GAME_DIR = path.resolve("fixture-root", "game");
const STAGING_DIR = path.resolve("fixture-root", "staging");

const qualified = (...parts: string[]) => QualifiedPath.fromNative(path.join(...parts));
const portable = (...parts: string[]) => qualified(...parts).path;

let installed: InstalledInMemoryFS | undefined;

afterEach(() => {
  installed?.restore();
  installed = undefined;
});

function seedGame(): InstalledInMemoryFS {
  return installInMemoryFS((builder) => {
    builder.file(qualified(GAME_DIR, "SkyrimSE.exe"), { type: "text", data: "game" });
    builder.file(qualified(GAME_DIR, "Data", "SkyUI_SE.esp"), { type: "text", data: "plugin" });
    builder.file(qualified(GAME_DIR, "Data", "meshes", "sword.nif"), {
      type: "text",
      data: "mesh",
    });
    builder.file(qualified(STAGING_DIR, "SkyUI", "SkyUI_SE.bsa"), {
      type: "text",
      data: "archive",
    });
    builder.file(qualified(STAGING_DIR, "moved", "textures", "sky.dds"), {
      type: "text",
      data: "texture",
    });
  });
}

describe("scanDeploymentTargets", () => {
  test("lists the files and links under a target, sorted by path, without folders", async () => {
    installed = seedGame();
    await installed.fs.createLink(
      qualified(STAGING_DIR, "SkyUI", "SkyUI_SE.bsa"),
      qualified(GAME_DIR, "Data", "SkyUI_SE.bsa"),
      "symlink",
    );

    const scan = await scanDeploymentTargets([path.join(GAME_DIR, "Data")], []);

    expect(scan.roots).toEqual([portable(GAME_DIR, "Data")]);
    expect(scan.entries.map(({ path: entryPath, kind }) => [entryPath, kind])).toEqual([
      [portable(GAME_DIR, "Data", "SkyUI_SE.bsa"), DiskEntryKind.Link],
      [portable(GAME_DIR, "Data", "SkyUI_SE.esp"), DiskEntryKind.File],
      [portable(GAME_DIR, "Data", "meshes", "sword.nif"), DiskEntryKind.File],
    ]);
  });

  test("records a file and a link with the status the file system reports for them", async () => {
    installed = seedGame();
    const { fs } = installed;
    const bsa = qualified(STAGING_DIR, "SkyUI", "SkyUI_SE.bsa");
    const link = qualified(GAME_DIR, "Data", "SkyUI_SE.bsa");
    await fs.createLink(bsa, link, "symlink");
    const esp = qualified(GAME_DIR, "Data", "SkyUI_SE.esp");
    const statusOf = async (target: QualifiedPath) => {
      const result = await fs.stat(target);
      if (!result.exists || !result.isFile) {
        throw new Error(`no file at ${target.path}`);
      }
      const { size, modifiedTime, id, deviceId, hardlinkCount } = result;
      return { size, modifiedTime, id, deviceId, hardlinkCount };
    };

    const scan = await scanDeploymentTargets([path.join(GAME_DIR, "Data")], []);

    expect(scan.entries.slice(0, 2)).toEqual([
      { path: link.path, kind: DiskEntryKind.Link, ...(await statusOf(bsa)) },
      { path: esp.path, kind: DiskEntryKind.File, ...(await statusOf(esp)) },
    ]);
  });

  test("lists a hardlinked file as a file with its staged file's id", async () => {
    installed = seedGame();
    const staged = qualified(STAGING_DIR, "SkyUI", "SkyUI_SE.bsa");
    const deployed = qualified(GAME_DIR, "Data", "SkyUI_SE.bsa");
    await installed.fs.createLink(staged, deployed, "hardlink");

    const scan = await scanDeploymentTargets([path.join(GAME_DIR, "Data"), STAGING_DIR], []);
    const entryAt = (target: QualifiedPath) =>
      scan.entries.find((entry) => entry.path === target.path);

    expect(entryAt(deployed)?.kind).toBe(DiskEntryKind.File);
    expect(entryAt(deployed)?.id).toBe(entryAt(staged)?.id);
    expect(entryAt(deployed)?.id).not.toBe(
      entryAt(qualified(GAME_DIR, "Data", "SkyUI_SE.esp"))?.id,
    );
  });

  test("walks through a link to a folder, listing its files under the link's path", async () => {
    installed = seedGame();
    await installed.fs.createLink(
      qualified(STAGING_DIR, "moved", "textures"),
      qualified(GAME_DIR, "Data", "textures"),
      "symlink",
    );

    const scan = await scanDeploymentTargets([path.join(GAME_DIR, "Data")], []);

    expect(scan.entries.map(({ path: entryPath, kind }) => [entryPath, kind])).toContainEqual([
      portable(GAME_DIR, "Data", "textures", "sky.dds"),
      DiskEntryKind.File,
    ]);
    expect(scan.entries.map(({ path: entryPath }) => entryPath)).not.toContain(
      portable(GAME_DIR, "Data", "textures"),
    );
  });

  test("lists a folder reached by two paths under both", async () => {
    installed = seedGame();
    await installed.fs.createLink(
      qualified(GAME_DIR, "Data", "meshes"),
      qualified(GAME_DIR, "Data", "alias"),
      "symlink",
    );

    const scan = await scanDeploymentTargets([path.join(GAME_DIR, "Data")], []);

    expect(scan.entries.map(({ path: entryPath }) => entryPath)).toEqual(
      expect.arrayContaining([
        portable(GAME_DIR, "Data", "alias", "sword.nif"),
        portable(GAME_DIR, "Data", "meshes", "sword.nif"),
      ]),
    );
  });

  test.each([
    ["the folder it links from", [path.join(GAME_DIR, "Data")]],
    ["a folder above it", [GAME_DIR]],
  ])("stops at a link back to a folder it is inside, scanning %s", async (_root, modPaths) => {
    installed = seedGame();
    await installed.fs.createLink(
      qualified(GAME_DIR, "Data"),
      qualified(GAME_DIR, "Data", "meshes", "loop"),
      "symlink",
    );

    const scan = await scanDeploymentTargets(modPaths, []);

    expect(scan.entries.filter(({ path: entryPath }) => entryPath.includes("/loop"))).toEqual([]);
  });

  test("walks a target inside another target once", async () => {
    installed = seedGame();

    const scan = await scanDeploymentTargets([GAME_DIR, path.join(GAME_DIR, "Data"), GAME_DIR], []);

    expect(scan.roots).toEqual([portable(GAME_DIR)]);
    expect(scan.entries.map(({ path: entryPath }) => entryPath)).toEqual([
      portable(GAME_DIR, "Data", "SkyUI_SE.esp"),
      portable(GAME_DIR, "Data", "meshes", "sword.nif"),
      portable(GAME_DIR, "SkyrimSE.exe"),
    ]);
  });

  test("walks a target spelt in another case once", async () => {
    installed = seedGame();

    const scan = await scanDeploymentTargets(
      [GAME_DIR, path.join(GAME_DIR, "DATA")],
      [portable(GAME_DIR, "data", "SkyUI_SE.esp")],
    );

    expect(scan.roots).toEqual([portable(GAME_DIR)]);
  });

  test("scans the folder of a destination outside every target", async () => {
    installed = seedGame();
    const pluginsTxt = portable(STAGING_DIR, "plugins.txt");

    const scan = await scanDeploymentTargets(
      [path.join(GAME_DIR, "Data")],
      [portable(GAME_DIR, "Data", "SkyUI_SE.esp"), pluginsTxt],
    );

    expect(scan.roots).toEqual([portable(GAME_DIR, "Data"), portable(STAGING_DIR)].toSorted());
  });

  test("fails the scan when a folder goes missing partway through the walk", async () => {
    installed = seedGame();
    window.api = {
      ...window.api,
      fs: new ChaosFS(installed.fs, [
        { op: "enumerateDirectory", fault: { kind: "fs:not-found" }, failAfter: 1 },
      ]),
    };

    await expect(scanDeploymentTargets([path.join(GAME_DIR, "Data")], [])).rejects.toThrow();
  });

  test("leaves out a mod type without a path", async () => {
    installed = seedGame();

    // a mod type's untyped getPath can return null or undefined
    const scan = await scanDeploymentTargets(
      [null, undefined, "", path.join(GAME_DIR, "Data")],
      [],
    );

    expect(scan.roots).toEqual([portable(GAME_DIR, "Data")]);
  });

  test("keeps a missing target as a root with nothing under it", async () => {
    installed = seedGame();

    const scan = await scanDeploymentTargets([path.join(GAME_DIR, "Mods")], []);

    expect(scan.roots).toEqual([portable(GAME_DIR, "Mods")]);
    expect(scan.entries).toEqual([]);
  });

  test("leaves out a link whose target is gone", async () => {
    installed = seedGame();
    await installed.fs.createLink(
      qualified(STAGING_DIR, "Removed", "gone.esp"),
      qualified(GAME_DIR, "Data", "gone.esp"),
      "symlink",
    );

    const scan = await scanDeploymentTargets([path.join(GAME_DIR, "Data")], []);

    expect(scan.entries.map(({ path: entryPath }) => entryPath)).not.toContain(
      portable(GAME_DIR, "Data", "gone.esp"),
    );
  });
});
