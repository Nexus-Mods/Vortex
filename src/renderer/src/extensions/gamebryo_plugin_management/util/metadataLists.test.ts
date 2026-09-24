import { mkdir, rm, utimes, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeLoot } from "../../../test-utils/builders";
import { makeTempDir } from "../../../test-utils/tempDir";
import type { IListPaths } from "./metadataLists";
import { listPaths, MetadataLists } from "./metadataLists";

const GAME = "skyrimse";

describe("MetadataLists", () => {
  let userData: string;
  let paths: IListPaths;

  const write = async (filePath: string, content: string) => {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  };

  beforeEach(async () => {
    userData = await makeTempDir("vortex-metadata-lists");
    paths = listPaths(userData, GAME);
    await write(paths.masterlist, "plugins: []\n");
  });

  afterEach(async () => {
    await rm(userData, { recursive: true, force: true });
  });

  it("loads the lists the first time they are needed", async () => {
    const loot = makeFakeLoot();
    const lists = new MetadataLists();

    expect(await lists.ensureLoaded(paths, loot)).toBe(true);
    expect(loot.loadListsAsync).toHaveBeenCalledWith(paths.masterlist, "", "");
  });

  it("loads again after a fresh masterlist replaces the one it holds", async () => {
    const loot = makeFakeLoot();
    const lists = new MetadataLists();

    await lists.ensureLoaded(paths, loot);
    await write(paths.masterlist, "plugins: [{ name: One.esp }]\n");
    // a rewrite inside the same file-time tick reads as unchanged, which is what invalidate is for
    await utimes(paths.masterlist, new Date(), new Date(Date.now() + 1000));
    await lists.ensureLoaded(paths, loot);

    expect(loot.loadListsAsync).toHaveBeenCalledTimes(2);
  });

  it("loads again after a rule change rewrites the userlist", async () => {
    const loot = makeFakeLoot();
    const lists = new MetadataLists();

    await lists.ensureLoaded(paths, loot);
    await write(paths.userlist, "plugins:\n  - name: One.esp\n    group: early\n");
    await lists.ensureLoaded(paths, loot);

    expect(loot.loadListsAsync).toHaveBeenLastCalledWith(paths.masterlist, paths.userlist, "");
  });

  it("passes the prelude once it is on disk", async () => {
    const loot = makeFakeLoot();
    const lists = new MetadataLists();

    await write(paths.prelude, "common:\n");
    await lists.ensureLoaded(paths, loot);

    expect(loot.loadListsAsync).toHaveBeenCalledWith(paths.masterlist, "", paths.prelude);
  });

  it("leaves the loaded lists alone while the files are unchanged", async () => {
    const loot = makeFakeLoot();
    const lists = new MetadataLists();

    await lists.ensureLoaded(paths, loot);

    expect(await lists.ensureLoaded(paths, loot)).toBe(false);
    expect(loot.loadListsAsync).toHaveBeenCalledTimes(1);
  });

  // a rewrite can land inside the same file-time tick, so callers that know they changed a list
  // say so
  it("loads again once the lists are invalidated", async () => {
    const loot = makeFakeLoot();
    const lists = new MetadataLists();

    await lists.ensureLoaded(paths, loot);
    lists.invalidate();
    await lists.ensureLoaded(paths, loot);

    expect(loot.loadListsAsync).toHaveBeenCalledTimes(2);
  });

  it("loads nothing while the game has no masterlist", async () => {
    const loot = makeFakeLoot();
    const lists = new MetadataLists();

    await rm(paths.masterlist);
    await lists.ensureLoaded(paths, loot);

    expect(loot.loadListsAsync).not.toHaveBeenCalled();
  });
});
