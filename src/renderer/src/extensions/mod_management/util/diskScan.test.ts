import * as path from "node:path";

import { DiskEntryKind } from "@nexusmods/mod-pipeline";
import { QualifiedPath } from "@vortex/shared/filesystem";
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

  test("records a file's size and identity", async () => {
    installed = seedGame();

    const scan = await scanDeploymentTargets([path.join(GAME_DIR, "Data")], []);

    expect(scan.entries[0]).toMatchObject({
      path: portable(GAME_DIR, "Data", "SkyUI_SE.esp"),
      size: "plugin".length,
      nlink: 1,
    });
    expect(scan.entries[0]?.inode).toEqual(expect.any(String));
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
