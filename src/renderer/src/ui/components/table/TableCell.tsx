import React, { type ReactNode } from "react";

import type { ITableColumn } from "./Table.types";

interface ITableCellProps {
  /** Where the content sits in the column, from the column's own `align`. */
  align?: ITableColumn<unknown>["align"];
  /** The cell's content, which truncates itself if it can run long. */
  children?: ReactNode;
  /** `columnheader` in the header row; `gridcell`, the default, everywhere else. */
  role?: "gridcell" | "columnheader";
}

/** A cell in its column's track. Its content truncates itself; the cell doesn't clip. */
export const TableCell = ({ align, children, role = "gridcell" }: ITableCellProps) => (
  <div className="nxm-table-cell" data-align={align} role={role}>
    {children}
  </div>
);
