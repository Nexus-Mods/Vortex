import { useCallback, useState } from "react";

import type { ITableColumn, ITableGroup, ITableSort } from "./Table.types";

/** The sort a click on a column's header asks for: the sorted column reversed, another A to Z. */
const nextSort = (previous: ITableSort | undefined, columnId: string): ITableSort => ({
  columnId,
  direction:
    previous?.columnId === columnId && previous.direction === "ascending"
      ? "descending"
      : "ascending",
});

/**
 * The table's sort: which column and which way, a toggle for a column's header, and the
 * rows put in that order. Choosing the sorted column again reverses it; another starts A
 * to Z. Rows keep the order they're given in while no sortable column is chosen. Given a
 * `controlled` sort, it sorts by that and hands each toggle to its `onSortChange`.
 */
export const useTableSort = <T, G extends ITableGroup<T>>(
  columns: Array<ITableColumn<T, G>>,
  defaultSort?: ITableSort,
  controlled?: { sort?: ITableSort; onSortChange?: (sort: ITableSort) => void },
) => {
  const [ownSort, setOwnSort] = useState(defaultSort);
  const isControlled = !!controlled?.sort;
  const sort = isControlled ? controlled.sort : ownSort;

  const toggleSort = (columnId: string) => {
    if (isControlled) {
      controlled.onSortChange?.(nextSort(controlled.sort, columnId));
      return;
    }

    setOwnSort((previous) => nextSort(previous, columnId));
  };

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
