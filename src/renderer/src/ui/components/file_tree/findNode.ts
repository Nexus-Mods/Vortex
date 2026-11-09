import type { RelativePath } from "@nexusmods/paths";

import { fileTreeNodeName, type IFileTreeNode } from "./types";

/**
 * The node at `path`, found by going down through the directories that are loaded. Names match
 * without regard to case, so the node's own path can differ from `path` in case. Undefined if
 * there is no such node, or it's below a directory that isn't loaded.
 */
export function findNode(
  nodes: readonly IFileTreeNode[],
  path: RelativePath,
): IFileTreeNode | undefined {
  let siblings = nodes;
  let found: IFileTreeNode | undefined;

  let start = 0;
  do {
    const end = path.indexOf("/", start);
    const segmentEnd = end === -1 ? path.length : end;
    const segment = path.slice(start, segmentEnd).toLowerCase();

    found = siblings.find((node) => fileTreeNodeName(node).toLowerCase() === segment);

    if (found === undefined) {
      return undefined;
    }

    siblings = found.children;
    if (segmentEnd < path.length && siblings === undefined) {
      return undefined;
    }

    start = segmentEnd + 1;
  } while (start <= path.length);

  return found;
}
