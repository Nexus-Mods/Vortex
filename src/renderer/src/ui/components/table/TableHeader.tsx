import React from "react";

import type { ITableColumn, ITableGroup } from "./Table.types";
import { TableCell } from "./TableCell";

interface ITableHeaderProps<T, G extends ITableGroup<T>> {
  columns: Array<ITableColumn<T, G>>;
}

/** The header row: each column's label, which names its cells to assistive tech. */
export const TableHeader = <T, G extends ITableGroup<T>>({ columns }: ITableHeaderProps<T, G>) => (
  <div className="nxm-table-header" role="row">
    {columns.map((column) => (
      <TableCell align={column.align} key={column.id} role="columnheader">
        <span className="truncate">{column.header}</span>
      </TableCell>
    ))}
  </div>
);
