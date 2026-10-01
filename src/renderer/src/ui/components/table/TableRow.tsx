import React from "react";

import type { ITableColumn, ITableGroup } from "./Table.types";
import { TableCell } from "./TableCell";

interface ITableRowProps<T, G extends ITableGroup<T>> {
  columns: Array<ITableColumn<T, G>>;
  /** The row's depth in a treegrid: 2 under a group. Unset in a flat grid. */
  level?: number;
  row: T;
}

/** One item's row: a cell per column, each a subgrid track of the table. */
export const TableRow = <T, G extends ITableGroup<T>>({
  columns,
  level,
  row,
}: ITableRowProps<T, G>) => (
  <div aria-level={level} className="nxm-table-row" role="row">
    {columns.map((column) => (
      <TableCell align={column.align} key={column.id}>
        {column.cell(row)}
      </TableCell>
    ))}
  </div>
);
