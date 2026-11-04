import { relativePath } from "@nexusmods/paths";
import { describe, expect, it } from "vitest";

import { findNode } from "./findNode";
import type { IFileTreeNode } from "./types";

// --- Helpers ---

const textures: IFileTreeNode = { path: relativePath("Data/Textures"), kind: "directory" };
const plugin: IFileTreeNode = { path: relativePath("Data/Game.esm"), kind: "file" };

const data: IFileTreeNode = {
  path: relativePath("Data"),
  kind: "directory",
  children: [textures, plugin],
};

const tree: IFileTreeNode[] = [data, { path: relativePath("root.txt"), kind: "file" }];

describe("findNode", () => {
  it("finds a node at the top level", () => {
    expect(findNode(tree, relativePath("Data"))).toBe(data);
  });

  it("finds a node inside loaded directories", () => {
    expect(findNode(tree, relativePath("Data/Game.esm"))).toBe(plugin);
    expect(findNode(tree, relativePath("Data/Textures"))).toBe(textures);
  });

  it("matches names without regard to case, and gives the node with its own path", () => {
    expect(findNode(tree, relativePath("data/TEXTURES"))?.path).toBe("Data/Textures");
  });

  it("is undefined for a node that isn't there", () => {
    expect(findNode(tree, relativePath("Missing"))).toBeUndefined();
    expect(findNode(tree, relativePath("Data/Missing"))).toBeUndefined();
  });

  it("is undefined below a directory that isn't loaded", () => {
    expect(findNode(tree, relativePath("Data/Textures/stone.dds"))).toBeUndefined();
  });

  it("is undefined below a file", () => {
    expect(findNode(tree, relativePath("root.txt/deeper"))).toBeUndefined();
  });

  it("is undefined for the empty path and an empty tree", () => {
    expect(findNode(tree, relativePath(""))).toBeUndefined();
    expect(findNode([], relativePath("Data"))).toBeUndefined();
  });
});
