import type { RelativePath } from "@nexusmods/paths";
import React, {
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

import { FileTreeItem } from "./FileTreeItem";
import { fileTreeNodeName, isEmptyDirectory, type IFileTreeNode } from "./types";

export interface IFileTreeProps extends Omit<
  HTMLAttributes<HTMLUListElement>,
  "children" | "onKeyDown" | "onSelect"
> {
  /** The directories whose children are showing. */
  expandedPaths: ReadonlySet<RelativePath>;
  /** The tree's top level. */
  nodes: readonly IFileTreeNode[];
  /** The selected node. */
  selectedPath?: RelativePath;
  /** Gives a node's row extra classes, such as to tell game files from a mod's. */
  getNodeClassName?: (node: IFileTreeNode) => string | undefined;
  /** Shows a node in place of its name, such as with a badge after it. */
  renderNode?: (node: IFileTreeNode) => ReactNode;
  /** Opens or closes directories; it gets the full set of open ones. */
  onExpandedChange: (paths: ReadonlySet<RelativePath>) => void;
  /**
   * Reads the children of a directory that has none yet, when it's first opened. The tree doesn't
   * keep what it reads: once it resolves, `nodes` has to hold the children. If it rejects the
   * directory shows an error, and opening it again tries again.
   */
  onLoadChildren?: (node: IFileTreeNode) => Promise<void>;
  /** Selects a node, by a click or by moving to it with the keyboard. */
  onSelect?: (node: IFileTreeNode) => void;
}

interface IVisibleItem {
  level: number;
  node: IFileTreeNode;
  parentPath?: RelativePath;
  siblingCount: number;
  siblingIndex: number;
}

const visibleItems = (
  nodes: readonly IFileTreeNode[],
  expandedPaths: ReadonlySet<RelativePath>,
  level = 1,
  parentPath?: RelativePath,
  items: IVisibleItem[] = [],
): IVisibleItem[] => {
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];

    items.push({
      level,
      node,
      parentPath,
      siblingCount: nodes.length,
      siblingIndex: index + 1,
    });

    if (node.children !== undefined && expandedPaths.has(node.path)) {
      visibleItems(node.children, expandedPaths, level + 1, node.path, items);
    }
  }

  return items;
};

const withPath = (
  paths: ReadonlySet<RelativePath>,
  path: RelativePath,
  isPresent: boolean,
): ReadonlySet<RelativePath> => {
  const next = new Set(paths);

  if (isPresent) {
    next.add(path);
  } else {
    next.delete(path);
  }

  return next;
};

export const FileTree = ({
  className,
  expandedPaths,
  getNodeClassName,
  nodes,
  renderNode,
  selectedPath,
  onExpandedChange,
  onLoadChildren,
  onSelect,
  ...props
}: IFileTreeProps) => {
  const [focusedPath, setFocusedPath] = useState<RelativePath>();
  const [loadingPaths, setLoadingPaths] = useState<ReadonlySet<RelativePath>>(new Set());
  const [failedPaths, setFailedPaths] = useState<ReadonlySet<RelativePath>>(new Set());

  const itemElements = useRef(new Map<RelativePath, HTMLLIElement>());

  const items = useMemo(() => visibleItems(nodes, expandedPaths), [nodes, expandedPaths]);

  // Focus stays on the item it was last on, unless that's gone, as when its parent closed.
  const tabStopPath = items.some((item) => item.node.path === focusedPath)
    ? focusedPath
    : items[0]?.node.path;

  const setItemElement = (path: RelativePath, element: HTMLLIElement | null) => {
    if (element === null) {
      itemElements.current.delete(path);
    } else {
      itemElements.current.set(path, element);
    }
  };

  const select = (node: IFileTreeNode) => {
    onSelect?.(node);
  };

  // Moving to an item selects it, as in a file explorer.
  const focusItem = (item: IVisibleItem | undefined) => {
    if (item !== undefined) {
      setFocusedPath(item.node.path);
      itemElements.current.get(item.node.path)?.focus();
      select(item.node);
    }
  };

  const collapse = (node: IFileTreeNode) => {
    onExpandedChange(withPath(expandedPaths, node.path, false));
  };

  const expand = (node: IFileTreeNode) => {
    if (isEmptyDirectory(node)) {
      return;
    }

    onExpandedChange(withPath(expandedPaths, node.path, true));

    if (node.children !== undefined || onLoadChildren === undefined) {
      return;
    }

    if (loadingPaths.has(node.path)) {
      return;
    }

    setLoadingPaths((paths) => withPath(paths, node.path, true));
    setFailedPaths((paths) => withPath(paths, node.path, false));

    onLoadChildren(node)
      .catch(() => setFailedPaths((paths) => withPath(paths, node.path, true)))
      .finally(() => setLoadingPaths((paths) => withPath(paths, node.path, false)));
  };

  // A directory that failed to load is still open, so toggling it tries again.
  const toggle = (node: IFileTreeNode) => {
    if (expandedPaths.has(node.path) && !failedPaths.has(node.path)) {
      collapse(node);
    } else {
      expand(node);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const index = items.findIndex((item) => item.node.path === tabStopPath);

    if (index < 0) {
      return;
    }

    const { node, parentPath } = items[index];
    const isDirectory = node.kind === "directory";
    const isExpanded = expandedPaths.has(node.path);

    switch (event.key) {
      case "ArrowDown":
        focusItem(items[index + 1]);
        break;
      case "ArrowUp":
        focusItem(items[index - 1]);
        break;
      case "Home":
        focusItem(items[0]);
        break;
      case "End":
        focusItem(items[items.length - 1]);
        break;
      case "ArrowRight":
        if (isDirectory && !isExpanded) {
          expand(node);
        } else if (items[index + 1]?.parentPath === node.path) {
          focusItem(items[index + 1]);
        }
        break;
      case "ArrowLeft":
        if (isDirectory && isExpanded) {
          collapse(node);
        } else {
          focusItem(items.find((item) => item.node.path === parentPath));
        }
        break;
      case "Enter":
      case " ":
        select(node);
        break;
      default:
        return;
    }

    event.preventDefault();
  };

  return (
    <ul
      className={joinClasses(["nxm-file-tree", className])}
      role="tree"
      {...props}
      onKeyDown={handleKeyDown}
    >
      {items.map(({ level, node, siblingCount, siblingIndex }) => (
        <FileTreeItem
          className={getNodeClassName?.(node)}
          hasFailed={failedPaths.has(node.path)}
          isExpanded={node.kind === "directory" ? expandedPaths.has(node.path) : undefined}
          isLoading={loadingPaths.has(node.path)}
          isSelected={node.path === selectedPath}
          isTabStop={node.path === tabStopPath}
          itemRef={setItemElement}
          key={node.path}
          level={level}
          node={node}
          siblingCount={siblingCount}
          siblingIndex={siblingIndex}
          onClick={select}
          onFocus={(focused) => setFocusedPath(focused.path)}
          onToggle={toggle}
        >
          {renderNode?.(node) ?? <span className="truncate">{fileTreeNodeName(node)}</span>}
        </FileTreeItem>
      ))}
    </ul>
  );
};
