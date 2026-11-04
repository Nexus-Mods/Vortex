import { relativePath } from "@nexusmods/paths";
import { QualifiedPath } from "@vortex/shared/filesystem";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installInMemoryFS } from "@/test-utils/fsApi";
import type { FileTreeEntry } from "@/ui/components/file_tree/buildTree";

import { readFileTreeDirectory } from "./fileTree";

// --- Helpers ---

const root = QualifiedPath.fromNative("/game");

const text = { type: "text", data: "x" } as const;

const byPath = (entries: FileTreeEntry[]): FileTreeEntry[] =>
  [...entries].sort((a, b) => a.path.localeCompare(b.path));

describe("readFileTreeDirectory", () => {
  let restore: () => void;

  beforeEach(async () => {
    const installed = installInMemoryFS((builder) => {
      builder.file(root.join("game.exe"), text);
      builder.file(root.join("Data", "Game.esm"), text);
      builder.file(root.join("Data", "Textures", "stone.dds"), text);
    });

    await installed.fs.createDirectory(root.join("Empty"));

    restore = installed.restore;
  });

  afterEach(() => {
    restore();
  });

  it("reads the files and directories directly in the root, with their kinds", async () => {
    const entries = await readFileTreeDirectory(root);

    expect(byPath(entries)).toEqual([
      { path: relativePath("Data"), kind: "directory" },
      { path: relativePath("Empty"), kind: "directory" },
      { path: relativePath("game.exe"), kind: "file" },
    ]);
  });

  it("reads the root when given an empty path", async () => {
    expect(await readFileTreeDirectory(root, relativePath(""))).toEqual(
      await readFileTreeDirectory(root),
    );
  });

  it("reads a directory below the root, with paths relative to the root", async () => {
    const entries = await readFileTreeDirectory(root, relativePath("Data"));

    expect(byPath(entries)).toEqual([
      { path: relativePath("Data/Game.esm"), kind: "file" },
      { path: relativePath("Data/Textures"), kind: "directory" },
    ]);
  });

  it("doesn't read below the directory it was asked for", async () => {
    const entries = await readFileTreeDirectory(root, relativePath("Data"));

    expect(entries.map(({ path }) => path)).not.toContain("Data/Textures/stone.dds");
  });

  it("reads an empty directory as holding nothing", async () => {
    expect(await readFileTreeDirectory(root, relativePath("Empty"))).toEqual([]);
  });

  it("reads a directory that doesn't exist as holding nothing", async () => {
    expect(await readFileTreeDirectory(root, relativePath("Missing"))).toEqual([]);
  });

  it("throws when the path is a file", async () => {
    await expect(readFileTreeDirectory(root, relativePath("game.exe"))).rejects.toThrow();
  });
});
