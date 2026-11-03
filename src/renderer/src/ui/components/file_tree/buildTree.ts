import { PathError, type RelativePath } from "@nexusmods/paths";

import { fileTreeNodeName, type IFileTreeNode } from "./types";

export type FileTreeEntry = Pick<IFileTreeNode, "path" | "kind">;

type MutableNode = {
  path: RelativePath;
  kind: IFileTreeNode["kind"];
  children: Map<RelativePath, MutableNode>;
};

const compareNodes = (a: IFileTreeNode, b: IFileTreeNode): number => {
  if (a.kind !== b.kind) {
    return a.kind === "directory" ? -1 : 1;
  }

  return fileTreeNodeName(a).localeCompare(fileTreeNodeName(b), undefined, {
    sensitivity: "base",
    numeric: true,
  });
};

const toNode = (node: MutableNode): IFileTreeNode =>
  node.kind === "directory"
    ? {
        path: node.path,
        kind: "directory",
        children: [...node.children.values()].map(toNode).sort(compareNodes),
      }
    : { path: node.path, kind: "file" };

/**
 * Nests a flat list of entries into a tree, directories first and then by name. Every directory in
 * the result has its `children` set, so none of them look unloaded.
 *
 * Directories above an entry are implied, so listing one is only needed for an empty directory.
 * Listing the same entry twice is fine.
 *
 * @throws {@link PathError} if the entries contradict each other: a path listed as both a file and
 * a directory, or a file with other entries beneath it.
 */
export function buildFileTree(entries: readonly FileTreeEntry[]): IFileTreeNode[] {
  const roots = new Map<RelativePath, MutableNode>();

  for (const { path, kind } of entries) {
    if (path === "") {
      throw new PathError("A tree entry must have a path", path);
    }

    const segments = path.split("/");

    let siblings = roots;

    for (let index = 0; index < segments.length; index++) {
      const isLast = index === segments.length - 1;

      // A prefix of a valid `RelativePath` is one too.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const nodePath = segments.slice(0, index + 1).join("/") as RelativePath;
      const nodeKind = isLast ? kind : "directory";

      let node = siblings.get(nodePath);

      if (node === undefined) {
        node = { path: nodePath, kind: nodeKind, children: new Map() };
        siblings.set(nodePath, node);
      } else if (node.kind !== nodeKind) {
        throw new PathError(
          isLast
            ? `"${path}" is listed as both a file and a directory`
            : `"${nodePath}" is a file but "${path}" is beneath it`,
          path,
        );
      }

      siblings = node.children;
    }
  }

  return [...roots.values()].map(toNode).sort(compareNodes);
}
