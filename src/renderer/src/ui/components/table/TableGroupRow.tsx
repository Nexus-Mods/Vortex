import { mdiChevronDown, mdiChevronRight } from "@mdi/js";
import React, { Fragment } from "react";

import { Icon } from "@/ui/components/icon/Icon";

import type { IColumnDef, ITableGroup } from "./Table.types";
import { TableRow } from "./TableRow";

interface ITableGroupRowProps<T> {
  group: ITableGroup<T>;
  columns: Array<IColumnDef<T>>;
  colSpan: number;
  collapsed: boolean;
  getRowId: (row: T) => string;
  onToggleCollapsed: (collapsed: boolean) => void;
}

/**
 * Collapsible group header row plus the group's data rows. Rendered once per
 * group when the table is grouped by a column.
 */
export const TableGroupRow = <T,>({
  group,
  columns,
  colSpan,
  collapsed,
  getRowId,
  onToggleCollapsed,
}: ITableGroupRowProps<T>) => {
  const rowLabel = group.rows.length === 1 ? "row" : "rows";

  return (
    <Fragment>
      <tr>
        <td className="nxm-table-group-cell" colSpan={colSpan}>
          <button
            aria-expanded={!collapsed}
            aria-label={`${group.label} group, ${group.rows.length} ${rowLabel}`}
            className="nxm-table-group-toggle"
            type="button"
            onClick={() => onToggleCollapsed(!collapsed)}
          >
            <Icon
              className="nxm-table-group-icon"
              path={collapsed ? mdiChevronRight : mdiChevronDown}
              size="sm"
            />

            <span className="nxm-table-group-label">{group.label}</span>

            <span className="nxm-table-group-count">{group.rows.length}</span>
          </button>
        </td>
      </tr>

      {!collapsed &&
        group.rows.map((row) => <TableRow columns={columns} key={getRowId(row)} row={row} />)}
    </Fragment>
  );
};
