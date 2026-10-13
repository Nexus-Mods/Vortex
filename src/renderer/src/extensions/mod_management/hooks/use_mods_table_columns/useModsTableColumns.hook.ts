import { useCallback, useMemo } from "react";

import type { ITableColumn } from "@/ui/components/table/Table.types";

import type {
  IModGroup,
  IModRow,
  IModsTableGroupingColumn,
} from "../../util/mods_table_views/modsTableViews";

export interface IModsTableColumn extends ITableColumn<IModRow, IModGroup> {
  /** Whether the view options can hide it; which show is the view's to say. */
  isToggleable?: boolean;
  /** Its legacy attribute's `position`, lowest first; default 100, ties keeping their order. */
  position?: number;
  /** The value a row is grouped under when the table groups by it; without one, it can't. */
  groupBy?: (row: IModRow) => string;
  /** Values whose groups come first, in this order; the rest follow by name. */
  groupOrder?: string[];
  /** Its name in the Group by options, where that isn't its header. */
  groupLabel?: string;
  /** The text its cell shows, which a search matches; without one, a search passes it by. */
  searchText?: (row: IModRow) => string;
}

/** A toggleable column, as the display options list it. */
export interface IModsTableColumnToggle {
  id: string;
  header: string;
  visible: boolean;
}

const byPosition = (a: IModsTableColumn, b: IModsTableColumn) =>
  (a.position ?? 100) - (b.position ?? 100);

/** The fixed columns, then the toggleable ones in the legacy table's order, then any sticky one. */
const ordered = (columns: IModsTableColumn[]) => [
  ...columns.filter((column) => !column.isToggleable && !column.sticky),
  ...columns.filter((column) => column.isToggleable).sort(byPosition),
  ...columns.filter((column) => column.sticky),
];

/**
 * The columns a view shows, the toggles to choose them with, and those it can group by.
 *
 * @param isShown Whether the view shows a toggleable column, by id.
 */
export const useModsTableColumns = (
  givenColumns: IModsTableColumn[],
  isShown: (columnId: string) => boolean,
) => {
  const columns = useMemo(() => ordered(givenColumns), [givenColumns]);

  const isVisible = useCallback(
    (column: IModsTableColumn) => !column.isToggleable || isShown(column.id),
    [isShown],
  );

  const visibleColumns = useMemo(() => columns.filter(isVisible), [columns, isVisible]);

  const toggles = useMemo<IModsTableColumnToggle[]>(
    () =>
      columns
        .filter((column) => column.isToggleable)
        .map((column) => ({ id: column.id, header: column.header, visible: isVisible(column) })),
    [columns, isVisible],
  );

  // In the table's order, hidden or not, as the legacy table offered them, by their group label.
  const groupable = useMemo(
    () =>
      columns
        .filter((column): column is IModsTableGroupingColumn & IModsTableColumn => !!column.groupBy)
        .map((column) => ({ ...column, header: column.groupLabel ?? column.header })),
    [columns],
  );

  return { visibleColumns, toggles, groupable };
};
