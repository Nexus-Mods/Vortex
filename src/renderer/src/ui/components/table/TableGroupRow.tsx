import { mdiChevronDown, mdiChevronRight } from "@mdi/js";
import React from "react";

import { Icon } from "@/ui/components/icon/Icon";

import type { ITableColumn, ITableGroup } from "./Table.types";
import { TableCell } from "./TableCell";
import { TableGroupWash } from "./TableGroupWash";

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
  /** Collapses or opens the group, from its button. */
  onToggle: () => void;
}

/**
 * A group's own row, above its rows: each column's group cell, the first after the
 * button that collapses the group. The table renders the rows, as siblings in its grid.
 */
export const TableGroupRow = <T, G extends ITableGroup<T>>({
  columns,
  expanded,
  group,
  index,
  onToggle,
  rowIndex,
}: ITableGroupRowProps<T, G>) => (
  <div
    aria-expanded={expanded}
    aria-level={1}
    aria-rowindex={rowIndex}
    className="nxm-table-group-row"
    data-index={index}
    role="row"
  >
    {columns.map((column, index) => (
      <TableCell
        align={column.align}
        key={column.id}
        sticky={column.sticky}
        tint={column.sticky ? group.image : undefined}
      >
        {index === 0 && (
          <button
            aria-expanded={expanded}
            aria-label={group.label}
            className="nxm-table-group-toggle"
            type="button"
            onClick={onToggle}
          >
            <Icon path={expanded ? mdiChevronDown : mdiChevronRight} size="none" />
          </button>
        )}

        {column.groupCell?.(group)}
      </TableCell>
    ))}

    {/* Last, so it's not the first child that the cells' columns start from. */}
    {!!group.image && <TableGroupWash src={group.image} />}
  </div>
);
