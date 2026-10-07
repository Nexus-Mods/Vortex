import React, { type HTMLAttributes, type ReactNode, useState } from "react";

import type { ITableColumn, ITableGroup } from "./Table.types";
import { TableCell } from "./TableCell";
import { type ITableCheckboxProps, TableCheckbox } from "./TableCheckbox";
import { TableRowEngagedContext } from "./TableRow.context";

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
  /** Its group's picture, for a sticky cell to tint itself with. */
  tint?: string;
  /** Its checkbox, at the start of its first cell, when rows can be selected. */
  checkbox?: ITableCheckboxProps;
  /** The column the rows are sorted by, whose cell stands out. */
  sortedColumnId?: string;
}

/**
 * The row's element, which notes once it's pointed at or focused. Its cells come in as
 * `children`, made by {@link TableRow}, so noting it re-renders only the cells that read it.
 */
const EngagingRow = ({
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) => {
  const [engaged, setEngaged] = useState(false);
  const engage = () => setEngaged(true);

  return (
    <div {...props} onFocus={engage} onPointerEnter={engage}>
      <TableRowEngagedContext.Provider value={engaged}>{children}</TableRowEngagedContext.Provider>
    </div>
  );
};

/**
 * One item's row: a cell per column, each a subgrid track of the table. Tells its cells once
 * it's been pointed at or focused, through `useTableRowEngaged`.
 */
export const TableRow = <T, G extends ITableGroup<T>>({
  columns,
  index,
  level,
  row,
  rowIndex,
  checkbox,
  sortedColumnId,
  tint,
}: ITableRowProps<T, G>) => (
  <EngagingRow
    aria-level={level}
    aria-rowindex={rowIndex}
    aria-selected={checkbox?.checked}
    className="nxm-table-row"
    data-index={index}
    role="row"
  >
    {columns.map((column, index) => (
      <TableCell
        align={column.align}
        key={column.id}
        sorted={column.id === sortedColumnId}
        sticky={column.sticky}
        tint={column.sticky ? tint : undefined}
      >
        {index === 0 && !!checkbox && <TableCheckbox {...checkbox} />}
        {column.cell(row)}
      </TableCell>
    ))}
  </EngagingRow>
);
