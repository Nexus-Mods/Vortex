import React from "react";

import type { ITableColumn, ITableGroup } from "./Table.types";
import { TableCell } from "./TableCell";

interface ITableRowProps<T, G extends ITableGroup<T>> {
  /** The table's columns, each rendering one of the row's cells. */
  columns: Array<ITableColumn<T, G>>;
  /** Its place among the table's rows, under the head. */
  index: number;
  /** Its place among every row, the head's included, counting from 1. */
  rowIndex: number;
  /** The row's depth in a treegrid: 2 under a group. Unset in a flat grid. */
  level?: number;
  /** The item the row shows, passed to each column's cell. */
  row: T;
}

/** One item's row: a cell per column, each a subgrid track of the table. */
export const TableRow = <T, G extends ITableGroup<T>>({
  columns,
  index,
  level,
  row,
  rowIndex,
}: ITableRowProps<T, G>) => (
  <div
    aria-level={level}
    aria-rowindex={rowIndex}
    className="nxm-table-row"
    data-index={index}
    role="row"
  >
    {columns.map((column) => (
      <TableCell align={column.align} key={column.id}>
        {column.cell(row)}
      </TableCell>
    ))}
  </div>
);
