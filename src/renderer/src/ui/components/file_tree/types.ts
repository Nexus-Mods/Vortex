import type { RelativePath } from "@nexusmods/paths";

export type FileTreeNodeKind = "file" | "directory";

export interface IFileTreeNode {
  /** Relative to the tree's root. Unique within the tree. */
  path: RelativePath;
  kind: FileTreeNodeKind;
  /** On a directory, undefined means it hasn't been loaded yet; see `onLoadChildren`. */
  children?: IFileTreeNode[];
}

/** The last segment of a node's path. */
export const fileTreeNodeName = (node: IFileTreeNode): string =>
  node.path.slice(node.path.lastIndexOf("/") + 1);
