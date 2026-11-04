import type { RelativePath } from "@nexusmods/paths";
import React, {
  type CSSProperties,
  Fragment,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useTableVirtualizer } from "@/ui/components/table/useTableVirtualizer.hook";
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
  /**
   * What to tell, in a tooltip over the error icon of a directory whose children failed to be
   * read, as `onLoadChildren` rejected. The icon has no text without it.
   */
  loadErrorMessage?: string;
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
  /**
   * A context menu is asked for on a node, by a right-click or Shift+F10 or the Menu key with the
   * node focused. The tree opens nothing itself; call `preventDefault` to keep the browser's
   * menu away.
   */
  onNodeContextMenu?: (node: IFileTreeNode, event: MouseEvent<HTMLElement>) => void;
  /** Selects a node, by a click or by moving to it with the keyboard. */
  onSelect?: (node: IFileTreeNode) => void;
}

/** The height of an item, which the virtualiser takes as exact; the stylesheet sizes it by it. */
export const FILE_TREE_ROW_HEIGHT = 28;

/** Stands in for items out of view, at their height, so the scroller keeps its full length. */
const Spacer = ({ height }: { height: number }) =>
  height ? <li aria-hidden={true} role="presentation" style={{ height: `${height}px` }} /> : null;

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

/**
 * A tree of files and directories. Only the items in view of its nearest scrolling ancestor are
 * rendered, plus the one Tab moves focus to, so a directory of thousands of files stays quick.
 * Without a scrolling ancestor every item renders.
 */
export const FileTree = ({
  className,
  expandedPaths,
  getNodeClassName,
  loadErrorMessage,
  nodes,
  renderNode,
  selectedPath,
  style,
  onExpandedChange,
  onLoadChildren,
  onNodeContextMenu,
  onSelect,
  ...props
}: IFileTreeProps) => {
  const [focusedPath, setFocusedPath] = useState<RelativePath>();
  const [loadingPaths, setLoadingPaths] = useState<ReadonlySet<RelativePath>>(new Set());
  const [failedPaths, setFailedPaths] = useState<ReadonlySet<RelativePath>>(new Set());

  const itemElements = useRef(new Map<RelativePath, HTMLLIElement>());
  // An item focus moves to that wasn't rendered yet; it's focused once it is.
  const pendingFocusPath = useRef<RelativePath>(undefined);

  const items = useMemo(() => visibleItems(nodes, expandedPaths), [nodes, expandedPaths]);

  // Focus stays on the item it was last on, unless that's gone, as when its parent closed.
  const focusedIndex = items.findIndex((item) => item.node.path === focusedPath);
  const tabStopIndex = Math.max(focusedIndex, 0);
  const tabStopPath = items[tabStopIndex]?.node.path;

  // The tab stop stays rendered, so Tab can reach the tree and the keys move from it.
  const keptIndexes = useMemo(() => [tabStopIndex], [tabStopIndex]);

  const virtual = useTableVirtualizer({
    count: items.length,
    getItemKey: (index) => items[index]?.node.path ?? String(index),
    getItemSize: () => FILE_TREE_ROW_HEIGHT,
    keptIndexes,
  });

  // Runs after every render, as the item to focus may only now be rendered. Focusing it
  // scrolls it into view, which the virtualiser follows.
  useLayoutEffect(() => {
    const path = pendingFocusPath.current;
    const element = path === undefined ? undefined : itemElements.current.get(path);

    if (element !== undefined) {
      pendingFocusPath.current = undefined;
      element.focus();
    }
  });

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

      const element = itemElements.current.get(item.node.path);

      if (element === undefined) {
        // out of view, so not rendered until it's the tab stop
        pendingFocusPath.current = item.node.path;
      } else {
        element.focus();
      }

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
    <div ref={virtual.tableRef} onBlur={virtual.onBlur} onFocus={virtual.onFocus}>
      {/* Always rendered, at the top of the items: where the virtualiser measures from. */}
      <div ref={virtual.startRef} role="presentation" />

      <ul
        className={joinClasses(["nxm-file-tree", className])}
        role="tree"
        style={
          { "--nxm-file-tree-row-height": `${FILE_TREE_ROW_HEIGHT}px`, ...style } as CSSProperties
        }
        {...props}
        onKeyDown={handleKeyDown}
      >
        {virtual.items.map(({ gap, index }) => {
          const { level, node, siblingCount, siblingIndex } = items[index];

          return (
            <Fragment key={node.path}>
              {/* Items out of view, before the tab stop kept far from the rest too. */}
              <Spacer height={gap} />

              <FileTreeItem
                className={getNodeClassName?.(node)}
                failedMessage={loadErrorMessage}
                hasFailed={failedPaths.has(node.path)}
                index={index}
                isExpanded={node.kind === "directory" ? expandedPaths.has(node.path) : undefined}
                isLoading={loadingPaths.has(node.path)}
                isSelected={node.path === selectedPath}
                isTabStop={node.path === tabStopPath}
                itemRef={setItemElement}
                level={level}
                node={node}
                siblingCount={siblingCount}
                siblingIndex={siblingIndex}
                onClick={select}
                onContextMenu={onNodeContextMenu}
                onFocus={(focused) => setFocusedPath(focused.path)}
                onToggle={toggle}
              >
                {renderNode?.(node) ?? <span className="truncate">{fileTreeNodeName(node)}</span>}
              </FileTreeItem>
            </Fragment>
          );
        })}

        <Spacer height={virtual.endGap} />
      </ul>
    </div>
  );
};
