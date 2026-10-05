import { useCallback, useState } from "react";

import type { ITableColumn, ITableGroup, ITableSort } from "./Table.types";

/**
 * The table's sort: which column and which way, a toggle for a column's header, and the
 * rows put in that order. Choosing the sorted column again reverses it; another starts A
 * to Z. Rows keep the order they're given in while no sortable column is chosen.
 */
export const useTableSort = <T, G extends ITableGroup<T>>(
  columns: Array<ITableColumn<T, G>>,
  defaultSort?: ITableSort,
) => {
  const [sort, setSort] = useState(defaultSort);

  const toggleSort = (columnId: string) =>
    setSort((previous) => ({
      columnId,
      direction:
        previous?.columnId === columnId && previous.direction === "ascending"
          ? "descending"
          : "ascending",
    }));

  const compare = columns.find((column) => column.id === sort?.columnId)?.sort;
  const reverse = sort?.direction === "descending";

  const sortRows = useCallback(
    (rows: T[]) => {
      if (compare === undefined) {
        return rows;
      }

      return [...rows].sort((a, b) => (reverse ? compare(b, a) : compare(a, b)));
    },
    [compare, reverse],
  );

  return { sort, sortRows, toggleSort };
};
