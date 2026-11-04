import { relativePath } from "@nexusmods/paths";
import { VortexError } from "@vortex/shared";
import { assert, describe, expect, it } from "vitest";

import type { FileTreeEntry } from "./buildTree";
import type { IFileTreeNode } from "./types";
import { childNodes, withChildren } from "./withChildren";

// --- Helpers ---

const file = (path: string): FileTreeEntry => ({ path: relativePath(path), kind: "file" });

const directory = (path: string): FileTreeEntry => ({
  path: relativePath(path),
  kind: "directory",
});

const loaded = (path: string, children: IFileTreeNode[]): IFileTreeNode => ({
  path: relativePath(path),
  kind: "directory",
  children,
});

const paths = (nodes: readonly IFileTreeNode[] | undefined): string[] =>
  (nodes ?? []).map((node) => node.path);

const root = relativePath("");

describe("childNodes", () => {
  it("makes a node for each entry, sorted directories first and then by name", () => {
    const nodes = childNodes(relativePath("a"), [
      file("a/z.txt"),
      directory("a/y"),
      file("a/b.txt"),
    ]);

    expect(paths(nodes)).toEqual(["a/y", "a/b.txt", "a/z.txt"]);
  });

  it("leaves directories unloaded and files without children", () => {
    const [folder, plain] = childNodes(relativePath("a"), [directory("a/dir"), file("a/f.txt")]);

    expect(folder).toEqual({ path: "a/dir", kind: "directory" });
    expect(folder).not.toHaveProperty("children");
    expect(plain).toEqual({ path: "a/f.txt", kind: "file" });
  });

  it("takes the top level when the parent is empty", () => {
    expect(paths(childNodes(root, [file("b.txt"), directory("a")]))).toEqual(["a", "b.txt"]);
  });

  it("gives nothing for no entries", () => {
    expect(childNodes(relativePath("a"), [])).toEqual([]);
  });

  it("throws for an entry that is deeper than a direct child", () => {
    expect(() => childNodes(relativePath("a"), [file("a/b/c.txt")])).toThrow(VortexError);
    expect(() => childNodes(root, [file("a/b.txt")])).toThrow(VortexError);
  });

  it("throws for an entry outside the parent", () => {
    expect(() => childNodes(relativePath("a"), [file("b/c.txt")])).toThrow(VortexError);
    expect(() => childNodes(relativePath("a"), [file("ab.txt")])).toThrow(VortexError);
  });

  it("throws for the parent itself", () => {
    expect(() => childNodes(relativePath("a"), [directory("a")])).toThrow(VortexError);
  });

  it("throws for an entry listed twice", () => {
    expect(() => childNodes(relativePath("a"), [file("a/b.txt"), file("a/b.txt")])).toThrow(
      VortexError,
    );
  });
});

describe("withChildren", () => {
  const unloaded: IFileTreeNode[] = [
    { path: relativePath("dir"), kind: "directory" },
    { path: relativePath("other"), kind: "directory" },
    { path: relativePath("root.txt"), kind: "file" },
  ];

  it("sets the children of a top level directory", () => {
    const tree = withChildren(unloaded, relativePath("dir"), [
      file("dir/a.txt"),
      directory("dir/sub"),
    ]);

    expect(paths(tree)).toEqual(["dir", "other", "root.txt"]);
    expect(paths(tree[0]?.children)).toEqual(["dir/sub", "dir/a.txt"]);
  });

  it("sets the children of a directory that is itself loaded", () => {
    const start = withChildren(unloaded, relativePath("dir"), [directory("dir/sub")]);
    const tree = withChildren(start, relativePath("dir/sub"), [file("dir/sub/b.txt")]);

    expect(paths(tree[0]?.children?.[0]?.children)).toEqual(["dir/sub/b.txt"]);
  });

  it("marks a directory with nothing in it as loaded and empty", () => {
    const tree = withChildren(unloaded, relativePath("dir"), []);

    expect(tree[0]?.children).toEqual([]);
  });

  it("replaces the children when the directory is read again", () => {
    const first = withChildren(unloaded, relativePath("dir"), [file("dir/old.txt")]);
    const tree = withChildren(first, relativePath("dir"), [file("dir/new.txt")]);

    expect(paths(tree[0]?.children)).toEqual(["dir/new.txt"]);
  });

  it("replaces the top level when the parent is empty", () => {
    const tree = withChildren(unloaded, root, [file("only.txt")]);

    expect(paths(tree)).toEqual(["only.txt"]);
  });

  it("keeps everything off the path to the parent as the same objects", () => {
    const start = withChildren(unloaded, relativePath("dir"), [
      directory("dir/sub"),
      directory("dir/keep"),
    ]);
    const tree = withChildren(start, relativePath("dir/sub"), [file("dir/sub/b.txt")]);

    expect(tree[1]).toBe(start[1]);
    expect(tree[2]).toBe(start[2]);

    const keep = (nodes: IFileTreeNode[]) =>
      nodes[0]?.children?.find(({ path }) => path === "dir/keep");

    expect(keep(tree)).toBeDefined();
    expect(keep(tree)).toBe(keep(start));
  });

  it("doesn't change the tree it was given", () => {
    const start = withChildren(unloaded, relativePath("dir"), [directory("dir/sub")]);
    const before = structuredClone(start);

    withChildren(start, relativePath("dir/sub"), [file("dir/sub/b.txt")]);

    expect(start).toEqual(before);
  });

  it("keeps the node's other properties", () => {
    const tree = withChildren(unloaded, relativePath("dir"), [file("dir/a.txt")]);

    assert(tree[0] !== undefined);
    expect(tree[0].path).toBe("dir");
    expect(tree[0].kind).toBe("directory");
  });

  it("throws when the parent isn't in the tree", () => {
    expect(() => withChildren(unloaded, relativePath("missing"), [])).toThrow(VortexError);
  });

  it("throws when the parent is inside a directory that isn't loaded", () => {
    expect(() => withChildren(unloaded, relativePath("dir/sub"), [])).toThrow(VortexError);
  });

  it("throws when the parent is a file", () => {
    expect(() => withChildren(unloaded, relativePath("root.txt"), [])).toThrow(VortexError);
  });

  it("throws for entries that aren't directly inside the parent, leaving nothing changed", () => {
    const tree = [loaded("dir", [])];

    expect(() => withChildren(tree, relativePath("dir"), [file("other/a.txt")])).toThrow(
      VortexError,
    );
    expect(tree[0]?.children).toEqual([]);
  });
});
