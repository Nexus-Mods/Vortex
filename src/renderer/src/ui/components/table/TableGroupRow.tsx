import { mdiChevronDown, mdiChevronRight } from "@mdi/js";
import React from "react";

import { Icon } from "@/ui/components/icon/Icon";

import type { ITableColumn, ITableGroup } from "./Table.types";
import { TableCell } from "./TableCell";
import { TableGroupWash } from "./TableGroupWash";

interface ITableGroupRowProps<T, G extends ITableGroup<T>> {
  columns: Array<ITableColumn<T, G>>;
  expanded: boolean;
  group: G;
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
  onToggle,
}: ITableGroupRowProps<T, G>) => (
  <div aria-expanded={expanded} aria-level={1} className="nxm-table-group-row" role="row">
    {columns.map((column, index) => (
      <TableCell align={column.align} key={column.id}>
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
