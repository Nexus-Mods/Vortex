import { PathError, relativePath } from "@nexusmods/paths";
import { describe, expect, it } from "vitest";

import { buildFileTree, type FileTreeEntry } from "./buildTree";
import type { IFileTreeNode } from "./types";

// --- Helpers ---

const file = (path: string): FileTreeEntry => ({ path: relativePath(path), kind: "file" });

const directory = (path: string): FileTreeEntry => ({
  path: relativePath(path),
  kind: "directory",
});

const paths = (nodes: IFileTreeNode[] | undefined): string[] => (nodes ?? []).map((n) => n.path);

describe("buildFileTree", () => {
  it("returns an empty tree for no entries", () => {
    expect(buildFileTree([])).toEqual([]);
  });

  it("keeps a single file at the root", () => {
    expect(buildFileTree([file("readme.txt")])).toEqual([{ path: "readme.txt", kind: "file" }]);
  });

  it("nests files under the directories their paths imply", () => {
    expect(buildFileTree([file("a/b/c.txt")])).toEqual([
      {
        path: "a",
        kind: "directory",
        children: [
          {
            path: "a/b",
            kind: "directory",
            children: [{ path: "a/b/c.txt", kind: "file" }],
          },
        ],
      },
    ]);
  });

  it("groups entries that share a directory", () => {
    const [a] = buildFileTree([file("a/one.txt"), file("a/two.txt")]);

    expect(a.kind).toBe("directory");
    expect(paths(a.children)).toEqual(["a/one.txt", "a/two.txt"]);
  });

  it("keeps an explicitly listed empty directory, with children set", () => {
    expect(buildFileTree([directory("empty")])).toEqual([
      { path: "empty", kind: "directory", children: [] },
    ]);
  });

  it("sorts directories before files, then by name", () => {
    const tree = buildFileTree([
      file("zebra.txt"),
      file("alpha.txt"),
      directory("zeta"),
      directory("beta"),
    ]);

    expect(paths(tree)).toEqual(["beta", "zeta", "alpha.txt", "zebra.txt"]);
  });

  it("sorts names without regard to case and with numbers in order", () => {
    const tree = buildFileTree([file("file10.txt"), file("File2.txt"), file("file1.txt")]);

    expect(paths(tree)).toEqual(["file1.txt", "File2.txt", "file10.txt"]);
  });

  it("sorts nested children too", () => {
    const [a] = buildFileTree([file("a/z.txt"), file("a/y/inner.txt"), file("a/b.txt")]);

    expect(paths(a.children)).toEqual(["a/y", "a/b.txt", "a/z.txt"]);
  });

  it("merges an exact duplicate", () => {
    const tree = buildFileTree([file("a/b.txt"), file("a/b.txt"), directory("a")]);

    expect(tree).toEqual([
      {
        path: "a",
        kind: "directory",
        children: [{ path: "a/b.txt", kind: "file" }],
      },
    ]);
  });

  it("accepts a directory listed after, and before, its children", () => {
    const after = buildFileTree([file("a/b.txt"), directory("a")]);
    const before = buildFileTree([directory("a"), file("a/b.txt")]);

    expect(after).toEqual(before);
  });

  it("gives files no children", () => {
    const [node] = buildFileTree([file("a.txt")]);

    expect(node).not.toHaveProperty("children");
  });

  describe("contradictory entries", () => {
    it("throws for a path listed as both a file and a directory", () => {
      expect(() => buildFileTree([file("foo"), directory("foo")])).toThrow(PathError);
      expect(() => buildFileTree([directory("foo"), file("foo")])).toThrow(PathError);
    });

    it("throws for a file with entries beneath it, whichever comes first", () => {
      expect(() => buildFileTree([file("foo/bar"), file("foo/bar/baz")])).toThrow(PathError);
      expect(() => buildFileTree([file("foo/bar/baz"), file("foo/bar")])).toThrow(PathError);
    });

    it("throws for a file with a directory beneath it", () => {
      expect(() => buildFileTree([file("foo"), directory("foo/bar")])).toThrow(PathError);
    });

    it("names the offending path", () => {
      expect(() => buildFileTree([file("foo/bar"), file("foo/bar/baz")])).toThrow(/foo\/bar/);
    });
  });

  it("throws for an empty path", () => {
    expect(() => buildFileTree([file("")])).toThrow(PathError);
  });
});
