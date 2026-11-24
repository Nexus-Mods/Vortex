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
  /**
   * Its legacy attribute's `position`, lowest first; default 100, ties keeping their order.
   * A column the user can't toggle takes its place only with one; without, it comes first.
   */
  position?: number;
  /** The value a row is grouped under when the table groups by it; without one, it can't. */
  groupBy?: (row: IModRow) => string;
  /** Values whose groups come first, in this order; the rest follow by name. */
  groupOrder?: readonly string[];
  /** The name a value's group shows, for values that are ids; the value itself, without one. */
  groupValueLabel?: (value: string) => string;
  /** The name of the group for rows without a value, whole, as languages don't build it alike. */
  noValueLabel?: string;
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

/** The `position` of a column that has none, as in the legacy table. */
export const DEFAULT_POSITION = 100;

const byPosition = (a: IModsTableColumn, b: IModsTableColumn) =>
  (a.position ?? DEFAULT_POSITION) - (b.position ?? DEFAULT_POSITION);

/** Whether it takes its place by position, as the legacy table places every attribute. */
const isPlaced = (column: IModsTableColumn) =>
  !column.sticky && (column.isToggleable === true || column.position !== undefined);

/**
 * The fixed columns without a position, then the others in the legacy table's order, as an
 * extension's column the user can't toggle has one, then any sticky one.
 */
const ordered = (columns: IModsTableColumn[]) => [
  ...columns.filter((column) => !column.sticky && !isPlaced(column)),
  ...columns.filter(isPlaced).sort(byPosition),
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
