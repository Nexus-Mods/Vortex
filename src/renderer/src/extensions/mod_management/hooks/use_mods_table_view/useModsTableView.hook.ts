import { useCallback, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { IState } from "@/types/IState";
import type { ITableSort } from "@/ui/components/table/Table.types";

import {
  addModsTableView,
  removeModsTableView,
  renameModsTableView,
  resetModsTableView,
  selectModsTableView,
  setModsTableViewColumn,
  setModsTableViewColumnWidths,
  setModsTableViewGrouping,
  resetModsTableViewFilters,
  setModsTableViewFilters,
  setModsTableViewSort,
} from "../../actions/modsTableViews";
import type { IModsTableCustomView, IModsTableViewChanges } from "../../reducers/modsTableViews";
import type { IModWithState } from "../../types/IModProps";
import {
  changedFilterKeys,
  type IModsTableFilters,
  NO_MODS_TABLE_FILTERS,
} from "../../util/mods_table_filters/modsTableFilters";
import {
  availableViews,
  type IModsTableView,
  type ModsTableGrouping,
  NEW_VIEW_DEFAULTS,
} from "../../util/mods_table_views/modsTableViews";
import {
  type ModsTableViewSource,
  useModsTableAnalytics,
} from "../use_mods_table_analytics/useModsTableAnalytics.hook";

const NO_CUSTOM: IModsTableCustomView[] = [];
const NO_CHANGES: IModsTableViewChanges = {};
const NO_WIDTHS: { [columnId: string]: number } = {};

const viewsState = (state: IState) => state.settings.modsTableViews;

interface IUseModsTableViewOptions {
  /** The game's mods, which decide which built-in views are offered. */
  mods: { [id: string]: IModWithState };
  /** Columns every view shows until the user hides them: extensions' columns shown by default. */
  defaultShown: readonly string[];
  /** The columns the table has, its own and those extensions offer, whose choices a view copies. */
  columnIds: ReadonlySet<string>;
}

/**
 * The new Mods table's views, and the open one as the user left it: its filters, sort, grouping,
 * columns and their widths, which changing saves to it. A new view starts as the open one is
 * showing, and a built-in view it's made from goes back to its default filters, as on Browse.
 * A built-in view is edited while its filters differ from its defaults, which the bar's reset
 * puts back; View options' reset puts back its grouping. The user's own views have no
 * defaults to go back to. Its filters can be suspended for the visit, as when the table is asked to
 * show a mod they hide: it shows every mod, unedited, saving nothing, until they change or the open
 * view does. A built-in view that groups keeps to its grouping, which is what it's
 * for. An open view that's no longer offered, such as Updates once there are none, gives way to
 * the first.
 */
export const useModsTableView = ({ mods, defaultShown, columnIds }: IUseModsTableViewOptions) => {
  const dispatch = useDispatch();
  const analytics = useModsTableAnalytics();
  const state = useSelector(viewsState);
  const custom = state?.custom ?? NO_CUSTOM;

  const views = useMemo<IModsTableView[]>(
    () => [
      ...availableViews(mods),
      ...custom.map(({ id, name }) => ({
        id,
        label: name,
        defaults: NEW_VIEW_DEFAULTS,
        isCustom: true,
      })),
    ],
    [custom, mods],
  );

  const view = views.find(({ id }) => id === state?.selected) ?? views[0];
  const changes = state?.changes[view.id] ?? NO_CHANGES;
  const groupingLocked = !view.isCustom && view.defaults.grouping !== "none";
  const grouping = groupingLocked
    ? view.defaults.grouping
    : (changes.grouping ?? view.defaults.grouping);

  const isShownByDefault = useCallback(
    (columnId: string) =>
      view.defaults.columns.includes(columnId) || defaultShown.includes(columnId),
    [defaultShown, view],
  );

  const isColumnShown = useCallback(
    (columnId: string) => changes.columns?.[columnId] ?? isShownByDefault(columnId),
    [changes, isShownByDefault],
  );

  const columnWidths = changes.widths ?? NO_WIDTHS;
  const sort = changes.sort ?? view.defaults.sort;
  const [suspendedViewId, setSuspendedViewId] = useState<string>();

  if (suspendedViewId && suspendedViewId !== view.id) {
    setSuspendedViewId(undefined);
  }

  const isSuspended = suspendedViewId === view.id;
  const filters = useMemo<IModsTableFilters>(
    () => (isSuspended ? NO_MODS_TABLE_FILTERS : { ...view.defaults.filters, ...changes.filters }),
    [changes.filters, isSuspended, view.defaults.filters],
  );
  const changedFilters = view.isCustom ? [] : changedFilterKeys(filters, view.defaults.filters);
  const isEdited = changedFilters.length > 0;

  const canReset = !view.isCustom && grouping !== view.defaults.grouping;

  const select = useCallback(
    (viewId: string) => {
      const next = views.find(({ id }) => id === viewId);
      if (next !== undefined && next.id !== view.id) {
        analytics.onViewSelected(next);
      }
      dispatch(selectModsTableView(viewId));
    },
    [analytics, dispatch, view.id, views],
  );

  const setGrouping = useCallback(
    (next: ModsTableGrouping) => {
      if (next !== grouping) {
        analytics.onGroupingChanged(next);
      }
      dispatch(setModsTableViewGrouping(view.id, next));
    },
    [analytics, dispatch, grouping, view.id],
  );

  const setColumnVisible = useCallback(
    (columnId: string, visible: boolean) => {
      if (visible !== isColumnShown(columnId)) {
        analytics.onColumnToggled(columnId, visible);
      }
      dispatch(setModsTableViewColumn(view.id, columnId, visible));
    },
    [analytics, dispatch, isColumnShown, view.id],
  );

  const setFilters = useCallback(
    (change: Partial<IModsTableFilters>) => {
      if (change.status && changedFilterKeys({ status: change.status }, filters).length > 0) {
        analytics.onFilterChanged("status", change.status);
      }
      setSuspendedViewId(undefined);
      dispatch(setModsTableViewFilters(view.id, change));
    },
    [analytics, dispatch, filters, view.id],
  );

  const resetFilters = useCallback(
    (source: ModsTableViewSource, keys?: Array<keyof IModsTableFilters>) => {
      analytics.onViewChanged("reset", source);
      setSuspendedViewId(undefined);
      dispatch(resetModsTableViewFilters(view.id, keys));
    },
    [analytics, dispatch, view.id],
  );

  const suspendFilters = useCallback(() => setSuspendedViewId(view.id), [view.id]);

  const setSort = useCallback(
    (next: ITableSort) => {
      if (next.columnId !== sort.columnId || next.direction !== sort.direction) {
        analytics.onSortChanged(next);
      }
      dispatch(setModsTableViewSort(view.id, next));
    },
    [analytics, dispatch, sort, view.id],
  );

  const setColumnWidths = useCallback(
    (widths: { [columnId: string]: number | undefined }) =>
      dispatch(setModsTableViewColumnWidths(view.id, widths)),
    [dispatch, view.id],
  );

  const reset = useCallback(
    (source: ModsTableViewSource) => {
      analytics.onViewChanged("reset", source);
      dispatch(resetModsTableView(view.id));
    },
    [analytics, dispatch, view.id],
  );

  const addView = useCallback(
    (name: string, source: ModsTableViewSource) => {
      const id = `custom-${crypto.randomUUID()}`;
      const columns = { ...changes.columns };
      columnIds.forEach((columnId) => {
        columns[columnId] = isColumnShown(columnId);
      });
      analytics.onViewChanged("created", source);
      analytics.onViewSelected({ id, label: name, defaults: NEW_VIEW_DEFAULTS, isCustom: true });
      dispatch(
        addModsTableView(id, name, { sort, grouping, columns, widths: columnWidths, filters }),
      );
      if (isEdited) {
        dispatch(resetModsTableViewFilters(view.id, undefined));
      }
    },
    [
      analytics,
      changes,
      columnIds,
      columnWidths,
      dispatch,
      filters,
      grouping,
      isColumnShown,
      isEdited,
      sort,
      view.id,
    ],
  );

  const renameView = useCallback(
    (viewId: string, name: string) => {
      analytics.onViewChanged("renamed");
      dispatch(renameModsTableView(viewId, name));
    },
    [analytics, dispatch],
  );

  const removeView = useCallback(
    (viewId: string) => {
      analytics.onViewChanged("deleted");
      if (viewId === view.id) {
        analytics.onViewSelected(views[0]);
      }
      dispatch(removeModsTableView(viewId));
    },
    [analytics, dispatch, view.id, views],
  );

  return {
    views,
    view,
    grouping,
    groupingLocked,
    isColumnShown,
    columnWidths,
    sort,
    filters,
    changedFilters,
    isEdited,
    canReset,
    select,
    setGrouping,
    setSort,
    setFilters,
    resetFilters,
    suspendFilters,
    setColumnVisible,
    setColumnWidths,
    reset,
    addView,
    renameView,
    removeView,
  };
};
