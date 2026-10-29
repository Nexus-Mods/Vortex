import type { RelativePath } from "@nexusmods/paths";
import React, { type CSSProperties, type ReactNode } from "react";

import { Icon } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";

import { isEmptyDirectory, type IFileTreeNode } from "./types";

interface IFileTreeItemProps {
  /** What the item shows next to its icon. */
  children: ReactNode;
  className?: string;
  /** Reading its children failed. */
  hasFailed?: boolean;
  /** Whether its children are showing; only a directory's item has this. */
  isExpanded?: boolean;
  /** Its children are being read. */
  isLoading?: boolean;
  /** Whether it's the chosen one. */
  isSelected?: boolean;
  /** Whether it takes focus when the tree is tabbed to. */
  isTabStop: boolean;
  /** How deep it is, from 1. */
  level: number;
  node: IFileTreeNode;
  /** How many items share its parent. */
  siblingCount: number;
  /** Its place among the items that share its parent, from 1. */
  siblingIndex: number;
  /** Hands over its element, for moving focus to it. */
  itemRef: (path: RelativePath, element: HTMLLIElement | null) => void;
  onClick: (node: IFileTreeNode) => void;
  onFocus: (node: IFileTreeNode) => void;
  onToggle: (node: IFileTreeNode) => void;
}

export const FileTreeItem = ({
  children,
  className,
  hasFailed,
  isExpanded,
  isLoading,
  isSelected,
  isTabStop,
  itemRef,
  level,
  node,
  siblingCount,
  siblingIndex,
  onClick,
  onFocus,
  onToggle,
}: IFileTreeItemProps) => {
  const isDirectory = node.kind === "directory";
  const canExpand = isDirectory && !isEmptyDirectory(node);

  let statusIcon = <Icon name={isExpanded ? "keyboard_arrow_down" : "chevron_right"} size="sm" />;

  if (isLoading) {
    statusIcon = <Icon className="animate-spin" name="progress_activity" size="sm" />;
  } else if (hasFailed) {
    statusIcon = <Icon className="text-danger-strong" name="error" size="sm" />;
  }

  let kindIcon = <Icon name="description" size="sm" />;

  if (isDirectory) {
    kindIcon = <Icon name={isExpanded ? "folder_open" : "folder"} size="sm" />;
  }

  return (
    <li
      aria-busy={isLoading || undefined}
      aria-expanded={canExpand ? !!isExpanded : undefined}
      aria-level={level}
      aria-posinset={siblingIndex}
      aria-selected={!!isSelected}
      aria-setsize={siblingCount}
      data-path={node.path}
      ref={(element) => itemRef(node.path, element)}
      role="treeitem"
      className={joinClasses(["nxm-file-tree-item", className])}
      style={{ "--nxm-file-tree-level": level } as CSSProperties}
      tabIndex={isTabStop ? 0 : -1}
      onClick={() => onClick(node)}
      onFocus={() => onFocus(node)}
    >
      <span
        className="nxm-file-tree-toggle"
        data-testid={canExpand ? "file-tree-toggle" : undefined}
        onClick={
          canExpand
            ? (event) => {
                event.stopPropagation();
                onToggle(node);
              }
            : undefined
        }
      >
        {canExpand && statusIcon}
      </span>

      {kindIcon}

      {children}
    </li>
  );
};
