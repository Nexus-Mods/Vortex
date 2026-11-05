import { relativePath, type RelativePath } from "@nexusmods/paths";

import { compareNodes } from "./buildTree";
import { fileTreeNodeName, type IFileTreeNode } from "./types";

function newDirectory(parent: string, segment: string, rest: readonly string[]): IFileTreeNode {
  const path = relativePath(parent === "" ? segment : `${parent}/${segment}`);
  const [next, ...after] = rest;

  return {
    path,
    kind: "directory",
    children: next === undefined ? [] : [newDirectory(path, next, after)],
  };
}

function insertDirectory(
  nodes: IFileTreeNode[],
  parent: string,
  segments: readonly string[],
): IFileTreeNode[] {
  const [segment, ...rest] = segments;

  if (segment === undefined) {
    return nodes;
  }

  const existing = nodes.find(
    (node) => fileTreeNodeName(node).toLowerCase() === segment.toLowerCase(),
  );

  if (existing === undefined) {
    return [...nodes, newDirectory(parent, segment, rest)].sort(compareNodes);
  }

  // Nothing to add when it's already there, a file is in the way, or the directory isn't loaded,
  // in which case it's added once that happens.
  if (rest.length === 0 || existing.kind === "file" || existing.children === undefined) {
    return nodes;
  }

  const children = insertDirectory(existing.children, existing.path, rest);

  if (children === existing.children) {
    return nodes;
  }

  return nodes.map((node) => (node === existing ? { ...node, children } : node));
}

/**
 * The tree with `directories` added where it doesn't have them yet. Each is added as an empty,
 * loaded directory. Meant for directories that don't exist on disk yet, such as ones the user
 * wants to create.
 *
 * Names match without regard to case, and an added directory takes the path of the directory it
 * goes in. A directory below one that isn't loaded is skipped, so apply this to the current nodes
 * each time, and it shows up once that one is loaded.
 *
 * Nodes it doesn't change are the same objects as before, and if nothing changed the same array
 * is returned.
 */
export function withEmptyDirectories(
  nodes: IFileTreeNode[],
  directories: readonly RelativePath[],
): IFileTreeNode[] {
  let result = nodes;

  for (const directory of directories) {
    if (directory !== "") {
      result = insertDirectory(result, "", directory.split("/"));
    }
  }

  return result;
}
