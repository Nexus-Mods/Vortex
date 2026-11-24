import type { RelativePath } from "@nexusmods/paths";
import { VortexError } from "@vortex/shared";

import { compareNodes, type FileTreeEntry } from "./buildTree";
import type { IFileTreeNode } from "./types";

function isDirectChild(parent: RelativePath, child: RelativePath): boolean {
  if (parent === "") {
    return child !== "" && !child.includes("/");
  }

  return child.startsWith(`${parent}/`) && !child.slice(parent.length + 1).includes("/");
}

/**
 * The nodes for what a directory holds, directories first and then by name. Its directories are
 * unloaded, with no `children`, so opening one asks for its contents. An empty `parent` is the
 * tree's top level.
 *
 * @throws {@link VortexError} if an entry isn't directly inside `parent`, or is listed twice.
 */
export function childNodes(
  parent: RelativePath,
  entries: readonly FileTreeEntry[],
): IFileTreeNode[] {
  const seen = new Set<RelativePath>();

  for (const { path } of entries) {
    if (!isDirectChild(parent, path)) {
      throw new VortexError(`"${path}" is not directly inside "${parent}"`, {
        kind: "argument-invalid",
        argument: "entries",
      });
    }

    if (seen.has(path)) {
      throw new VortexError(`"${path}" is listed more than once`, {
        kind: "argument-invalid",
        argument: "entries",
      });
    }

    seen.add(path);
  }

  return entries.map(({ path, kind }): IFileTreeNode => ({ path, kind })).sort(compareNodes);
}

function replaceChildren(
  nodes: readonly IFileTreeNode[],
  parent: RelativePath,
  children: IFileTreeNode[],
): IFileTreeNode[] | undefined {
  for (const [index, node] of nodes.entries()) {
    let replacement: IFileTreeNode | undefined;

    if (node.path === parent) {
      if (node.kind === "file") {
        throw new VortexError(`"${parent}" is a file and can't have children`, {
          kind: "argument-invalid",
          argument: "parent",
        });
      }

      replacement = { ...node, children };
    } else if (node.children !== undefined && parent.startsWith(`${node.path}/`)) {
      const inner = replaceChildren(node.children, parent, children);

      if (inner !== undefined) {
        replacement = { ...node, children: inner };
      }
    }

    if (replacement !== undefined) {
      return [...nodes.slice(0, index), replacement, ...nodes.slice(index + 1)];
    }
  }

  return undefined;
}

/**
 * The tree with what `parent` holds set to `entries`, for when a directory has been read. Only
 * the nodes down to `parent` are replaced, so everything else is the same object as before. Doing
 * it again for a directory replaces its children. An empty `parent` replaces the top level.
 *
 * @throws {@link VortexError} if `parent` isn't a directory in the tree, or `entries` aren't valid
 * for it, see {@link childNodes}.
 */
export function withChildren(
  nodes: readonly IFileTreeNode[],
  parent: RelativePath,
  entries: readonly FileTreeEntry[],
): IFileTreeNode[] {
  const children = childNodes(parent, entries);

  if (parent === "") {
    return children;
  }

  const result = replaceChildren(nodes, parent, children);

  if (result === undefined) {
    throw new VortexError(`"${parent}" is not in the tree`, {
      kind: "argument-invalid",
      argument: "parent",
    });
  }

  return result;
}
