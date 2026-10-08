import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setAttributeVisible } from "@/actions/tables";
import type { IState } from "@/types/IState";
import type { ITableColumn } from "@/ui/components/table/Table.types";

import type { IModGroup, IModRow } from "../../util/modsTableViews";

/** Shared with the legacy table, so the columns a user chose there carry over. */
export const MODS_TABLE_ID = "mods";

export interface IModsTableColumn extends ITableColumn<IModRow, IModGroup> {
  /** Whether the display options can hide it. */
  isToggleable?: boolean;
  /** Whether it shows until the user says otherwise. Default true, as in the legacy table. */
  isDefaultVisible?: boolean;
  /** Its legacy attribute's `position`, lowest first; default 100, ties keeping their order. */
  position?: number;
}

/** A toggleable column, as the display options list it. */
export interface IModsTableColumnToggle {
  id: string;
  header: string;
  visible: boolean;
}

const tableAttributes = (state: IState) => state.settings.tables[MODS_TABLE_ID]?.attributes;

const isDefaultVisible = (column: IModsTableColumn) => column.isDefaultVisible ?? true;

const byPosition = (a: IModsTableColumn, b: IModsTableColumn) =>
  (a.position ?? 100) - (b.position ?? 100);

/**
 * The columns that can't be hidden, as given, then the rest in the legacy table's order.
 * The first stays first, since a group's row puts its collapse button there.
 */
const ordered = (columns: IModsTableColumn[]) => [
  ...columns.filter((column) => !column.isToggleable),
  ...columns.filter((column) => column.isToggleable).sort(byPosition),
];

/** The columns the user has chosen to show, and the toggles to choose them with. */
export const useModsTableColumns = (givenColumns: IModsTableColumn[]) => {
  const columns = useMemo(() => ordered(givenColumns), [givenColumns]);
  const dispatch = useDispatch();
  const attributes = useSelector(tableAttributes);

  const isVisible = useCallback(
    (column: IModsTableColumn) =>
      !column.isToggleable || (attributes?.[column.id]?.enabled ?? isDefaultVisible(column)),
    [attributes],
  );

  const visibleColumns = useMemo(() => columns.filter(isVisible), [columns, isVisible]);

  const toggles = useMemo<IModsTableColumnToggle[]>(
    () =>
      columns
        .filter((column) => column.isToggleable)
        .map((column) => ({ id: column.id, header: column.header, visible: isVisible(column) })),
    [columns, isVisible],
  );

  const canReset = columns.some(
    (column) => column.isToggleable && isVisible(column) !== isDefaultVisible(column),
  );

  const setColumnVisible = useCallback(
    (columnId: string, visible: boolean) =>
      dispatch(setAttributeVisible(MODS_TABLE_ID, columnId, visible)),
    [dispatch],
  );

  const resetColumns = useCallback(
    () =>
      columns
        .filter((column) => column.isToggleable)
        .forEach((column) => setColumnVisible(column.id, isDefaultVisible(column))),
    [columns, setColumnVisible],
  );

  return { visibleColumns, toggles, canReset, setColumnVisible, resetColumns };
};
