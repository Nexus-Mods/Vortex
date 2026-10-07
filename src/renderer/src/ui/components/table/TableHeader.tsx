import { mdiArrowDown, mdiArrowUp } from "@mdi/js";
import React, { type ReactNode } from "react";

import { Icon } from "@/ui/components/icon/Icon";

import type { ITableColumn, ITableGroup, ITableSort } from "./Table.types";
import { TableCell } from "./TableCell";

interface ITableHeaderProps<T, G extends ITableGroup<T>> {
  /** The table's columns, each giving a header cell its label. */
  columns: Array<ITableColumn<T, G>>;
  /** Controls above the header row, the head's first row when there are any. */
  toolbar?: ReactNode;
  /** The column the rows are sorted by, and which way, if any. */
  sort?: ITableSort;
  /** Sorts by a column, from its header's button; again reverses it. */
  onSort: (columnId: string) => void;
}

/**
 * The sticky head: any toolbar, then the header row, each column's label, which names its
 * cells to assistive tech; a sortable column's is a button that sorts by it. Only rows can sit in a grid, so the toolbar is one too, a single
 * cell across every column.
 */
export const TableHeader = <T, G extends ITableGroup<T>>({
  columns,
  toolbar,
  sort,
  onSort,
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
      {columns.map((column) => {
        const direction = sort?.columnId === column.id ? sort.direction : undefined;

        return (
          <TableCell
            align={column.align}
            ariaSort={column.sort === undefined ? undefined : (direction ?? "none")}
            key={column.id}
            role="columnheader"
          >
            {column.sort === undefined ? (
              <span className="nxm-table-header-label">{column.header}</span>
            ) : (
              <button
                className="nxm-table-sort-button"
                type="button"
                onClick={() => onSort(column.id)}
              >
                <span className="truncate">{column.header}</span>

                {!!direction && (
                  <Icon
                    className="nxm-table-sort-icon"
                    path={direction === "ascending" ? mdiArrowDown : mdiArrowUp}
                    size="none"
                  />
                )}
              </button>
            )}
          </TableCell>
        );
      })}
    </div>
  </div>
);
