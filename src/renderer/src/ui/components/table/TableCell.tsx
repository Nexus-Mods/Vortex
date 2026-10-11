import React, { type ReactNode } from "react";

import type { ITableColumn } from "./Table.types";
import { TableCellTint } from "./TableCellTint";

interface ITableCellProps {
  /** Where the content sits in the column, from the column's own `align`. */
  align?: ITableColumn<unknown>["align"];
  /** The cell's content, which truncates itself if it can run long. */
  children?: ReactNode;
  /** `columnheader` in the header row; `gridcell`, the default, everywhere else. */
  role?: "gridcell" | "columnheader";
  /** A sortable column header's sort: which way, or `none` while another column is sorted. */
  ariaSort?: "ascending" | "descending" | "none";
  /** Whether the rows are sorted by its column. */
  sorted?: boolean;
  /** From the column's own `sticky`. */
  sticky?: ITableColumn<unknown>["sticky"];
  /** A picture to tint a sticky cell with, as its group's rows are. */
  tint?: string;
}

/** A cell in its column's track. Its content truncates itself; the cell doesn't clip. */
export const TableCell = ({
  align,
  ariaSort,
  children,
  role = "gridcell",
  sorted = false,
  sticky,
  tint,
}: ITableCellProps) => (
  <div
    aria-sort={ariaSort}
    className="nxm-table-cell"
    data-align={align}
    data-sorted={sorted ? "" : undefined}
    data-sticky={sticky}
    role={role}
  >
    {!!tint && <TableCellTint src={tint} />}
    {children}
  </div>
);
