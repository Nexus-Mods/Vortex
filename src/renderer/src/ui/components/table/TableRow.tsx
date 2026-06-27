import React, { type ReactNode } from "react";

import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

import type { IColumnDef } from "./Table.types";

interface ITableRowProps<T> {
  columns: Array<IColumnDef<T>>;
  row: T;
}

export const TableRow = <T,>({ columns, row }: ITableRowProps<T>) => (
  <tr className="nxm-table-row">
    {columns.map((column) => (
      <td
        className={joinClasses("nxm-table-td", {
          "nxm-table-cell-center": column.align === "center",
          "nxm-table-cell-right": column.align === "right",
        })}
        key={column.id}
      >
        <div className="nxm-table-cell-inner">
          {column.cell ? column.cell(row) : String(column.getValue?.(row) ?? "")}
        </div>
      </td>
    ))}
  </tr>
);

interface ITableEmptyRowProps {
  colSpan: number;
  emptyState?: ReactNode;
}

export const TableEmptyRow = ({ colSpan, emptyState }: ITableEmptyRowProps) => (
  <tr>
    <td className="nxm-table-empty" colSpan={colSpan}>
      {emptyState ?? <Typography appearance="subdued">No results found.</Typography>}
    </td>
  </tr>
);
