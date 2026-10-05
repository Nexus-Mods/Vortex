import React, { type ReactNode } from "react";

import type { ITableColumn, ITableGroup } from "./Table.types";
import { TableCell } from "./TableCell";

interface ITableHeaderProps<T, G extends ITableGroup<T>> {
  /** The table's columns, each giving a header cell its label. */
  columns: Array<ITableColumn<T, G>>;
  /** Controls above the header row, the head's first row when there are any. */
  toolbar?: ReactNode;
}

/**
 * The sticky head: any toolbar, then the header row, each column's label, which names its
 * cells to assistive tech. Only rows can sit in a grid, so the toolbar is one too, a single
 * cell across every column.
 */
export const TableHeader = <T, G extends ITableGroup<T>>({
  columns,
  toolbar,
}: ITableHeaderProps<T, G>) => (
  <div className="nxm-table-head" role="rowgroup">
    {!!toolbar && (
      <div aria-rowindex={1} className="nxm-table-toolbar" role="row">
        <div aria-colspan={columns.length} className="nxm-table-toolbar-cell" role="gridcell">
          {toolbar}
        </div>
      </div>
    )}

    <div aria-rowindex={toolbar ? 2 : 1} className="nxm-table-header" role="row">
      {columns.map((column) => (
        <TableCell align={column.align} key={column.id} role="columnheader">
          <span className="truncate">{column.header}</span>
        </TableCell>
      ))}
    </div>
  </div>
);
