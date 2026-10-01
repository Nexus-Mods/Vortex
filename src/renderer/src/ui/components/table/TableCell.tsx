import React, { type ReactNode } from "react";

import type { ITableColumn } from "./Table.types";

interface ITableCellProps {
  align?: ITableColumn<unknown>["align"];
  children?: ReactNode;
  role?: "gridcell" | "columnheader";
}

/** A cell in its column's track. Its content truncates itself; the cell doesn't clip. */
export const TableCell = ({ align, children, role = "gridcell" }: ITableCellProps) => (
  <div className="nxm-table-cell" data-align={align} role={role}>
    {children}
  </div>
);
