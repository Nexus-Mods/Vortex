import React, { type MouseEvent, type ReactNode } from "react";

import { Icon } from "@/ui/components/icon/Icon";

import type { ITableColumn, ITableGroup } from "./Table.types";
import { TableCell } from "./TableCell";

interface ITableGroupRowProps<T, G extends ITableGroup<T>> {
  /** The table's columns, each rendering one of the group's cells. */
  columns: Array<ITableColumn<T, G>>;
  /** Whether the group's rows are showing, which sets the button's chevron. */
  expanded: boolean;
  /** The group the row heads, passed to each column's group cell. */
  group: G;
  /** Its place among the table's rows, under the head. */
  index: number;
  /** Its place among every row, the head's included, counting from 1. */
  rowIndex: number;
  /** The group's "…", after the sticky column's group cell, or the last column's without one. */
  menu: ReactNode;
  /** Collapses or opens the group, from its button. */
  onToggle: () => void;
  /** Opens the group's context menu, from a right-click or the keyboard's menu key. */
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
}

/**
 * A group's own row, above its rows: each column's group cell, the first after the
 * button that collapses the group, and the group's "…" at the end of the sticky column's, or of
 * the last column's. The table renders the rows, as siblings in its grid.
 */
export const TableGroupRow = <T, G extends ITableGroup<T>>({
  columns,
  expanded,
  group,
  index,
  menu,
  onToggle,
  onContextMenu,
  rowIndex,
}: ITableGroupRowProps<T, G>) => {
  const sticky = columns.findIndex((column) => column.sticky === "end");
  const menuIndex = sticky === -1 ? columns.length - 1 : sticky;

  return (
    <div
      aria-expanded={expanded}
      aria-level={1}
      aria-rowindex={rowIndex}
      className="nxm-table-group-row"
      data-index={index}
      role="row"
      onContextMenu={(event) => {
        if (onContextMenu && event.currentTarget.contains(event.target as Node)) {
          onContextMenu(event);
        }
      }}
    >
      {columns.map((column, index) => (
        <TableCell align={column.align} key={column.id} sticky={column.sticky}>
          {index === 0 && (
            <button
              aria-expanded={expanded}
              aria-label={group.label}
              className="nxm-table-group-toggle"
              type="button"
              onClick={onToggle}
            >
              <Icon name={expanded ? "keyboard_arrow_down" : "chevron_right"} size="none" />
            </button>
          )}

          {column.groupCell?.(group)}

          {index === menuIndex && menu}
        </TableCell>
      ))}
    </div>
  );
};
