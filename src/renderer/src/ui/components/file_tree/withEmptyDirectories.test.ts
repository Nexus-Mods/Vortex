import { relativePath } from "@nexusmods/paths";
import { describe, expect, it } from "vitest";

import type { IFileTreeNode } from "./types";
import { withEmptyDirectories } from "./withEmptyDirectories";

// --- Helpers ---

const file = (path: string): IFileTreeNode => ({ path: relativePath(path), kind: "file" });

const unloaded = (path: string): IFileTreeNode => ({
  path: relativePath(path),
  kind: "directory",
});

const loaded = (path: string, children: IFileTreeNode[] = []): IFileTreeNode => ({
  path: relativePath(path),
  kind: "directory",
  children,
});

const add = (nodes: IFileTreeNode[], ...directories: string[]) =>
  withEmptyDirectories(nodes, directories.map(relativePath));

const paths = (nodes: readonly IFileTreeNode[] | undefined): string[] =>
  (nodes ?? []).map((node) => node.path);

describe("withEmptyDirectories", () => {
  it("adds a directory that isn't in the tree as an empty, loaded one", () => {
    expect(add([file("a.txt")], "New")).toEqual([loaded("New"), file("a.txt")]);
  });

  it("adds a chain of directories for a nested path", () => {
    expect(add([], "a/b/c")).toEqual([loaded("a", [loaded("a/b", [loaded("a/b/c")])])]);
  });

  it("adds a directory inside a loaded one", () => {
    const tree = add([loaded("Data", [file("Data/a.txt")])], "Data/New");

    expect(paths(tree[0]?.children)).toEqual(["Data/New", "Data/a.txt"]);
    expect(tree[0]?.children?.[0]).toEqual(loaded("Data/New"));
  });

  it("adds only the missing part of a path", () => {
    const tree = add([loaded("Data", [loaded("Data/Textures")])], "Data/Textures/New/Deep");

    const added = loaded("Data/Textures/New", [loaded("Data/Textures/New/Deep")]);

    expect(tree).toEqual([loaded("Data", [loaded("Data/Textures", [added])])]);
  });

  it("keeps directories first and sorts by name", () => {
    const tree = add([loaded("b"), file("a.txt"), loaded("d")], "c");

    expect(paths(tree)).toEqual(["b", "c", "d", "a.txt"]);
  });

  it("leaves out a directory below one that isn't loaded", () => {
    const tree = [unloaded("Data")];

    expect(add(tree, "Data/New")).toBe(tree);
  });

  it("returns the same array when the directory is already there", () => {
    const tree = [loaded("Data", [loaded("Data/Textures")])];

    expect(add(tree, "Data")).toBe(tree);
    expect(add(tree, "Data/Textures")).toBe(tree);
  });

  it("returns the same array when the directory is there but not loaded", () => {
    const tree = [unloaded("Data")];

    expect(add(tree, "Data")).toBe(tree);
  });

  it("matches existing directories without regard to case, and takes their path", () => {
    const tree = add([loaded("Data")], "data/New");

    expect(paths(tree)).toEqual(["Data"]);
    expect(paths(tree[0]?.children)).toEqual(["Data/New"]);
  });

  it("leaves out a directory where a file is in the way", () => {
    const tree = [file("a"), loaded("b")];

    expect(add(tree, "a")).toBe(tree);
    expect(add(tree, "a/deeper")).toBe(tree);
  });

  it("adds several directories", () => {
    expect(paths(add([], "b", "a", "c/d"))).toEqual(["a", "b", "c"]);
  });

  it("ignores the empty path", () => {
    const tree = [loaded("a")];

    expect(add(tree, "")).toBe(tree);
  });

  it("keeps everything off the path to the new directory as the same objects", () => {
    const other = loaded("Other", [file("Other/x.txt")]);
    const keep = loaded("Data/Keep");
    const rootFile = file("root.txt");
    const tree = add([other, loaded("Data", [keep]), rootFile], "Data/New");

    expect(tree).toContain(other);
    expect(tree).toContain(rootFile);
    expect(tree.find((node) => node.path === "Data")?.children).toContain(keep);
  });

  it("doesn't change the tree it was given", () => {
    const tree = [loaded("Data", [file("Data/a.txt")])];
    const before = structuredClone(tree);

    add(tree, "Data/New", "Other");

    expect(tree).toEqual(before);
  });

  it("gives the same tree when applied twice", () => {
    const once = add([loaded("Data")], "Data/New");

    expect(withEmptyDirectories(once, [relativePath("Data/New")])).toBe(once);
  });
});
