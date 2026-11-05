import { relativePath, type RelativePath } from "@nexusmods/paths";

export type FileTreeNodeKind = "file" | "directory";

export interface IFileTreeNode {
  /** Relative to the tree's root. Unique within the tree. */
  path: RelativePath;
  kind: FileTreeNodeKind;
  /** On a directory, undefined means it hasn't been loaded yet; see `onLoadChildren`. */
  children?: IFileTreeNode[];
}

/** A directory known to hold nothing; one that isn't loaded yet isn't known to. */
export const isEmptyDirectory = (node: IFileTreeNode): boolean =>
  node.kind === "directory" && node.children?.length === 0;

/** The last segment of a path. */
export function pathName(path: RelativePath): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** The path of the directory a path is in; the root, which is empty, for a top level one. */
export function parentPath(path: RelativePath): RelativePath {
  return relativePath(path.slice(0, Math.max(path.lastIndexOf("/"), 0)));
}

/** The last segment of a node's path. */
export const fileTreeNodeName = (node: IFileTreeNode): string => pathName(node.path);
