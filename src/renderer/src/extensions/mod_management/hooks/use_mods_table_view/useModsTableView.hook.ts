import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { IState } from "@/types/IState";

import {
  addModsTableView,
  removeModsTableView,
  renameModsTableView,
  resetModsTableView,
  selectModsTableView,
  setModsTableViewColumn,
  setModsTableViewGrouping,
} from "../../actions/modsTableViews";
import type { IModsTableCustomView, IModsTableViewChanges } from "../../reducers/modsTableViews";
import type { IModWithState } from "../../types/IModProps";
import {
  availableViews,
  type IModsTableView,
  type ModsTableGrouping,
  NEW_VIEW_DEFAULTS,
} from "../../util/mods_table_views/modsTableViews";
import { useModsTableAnalytics } from "../use_mods_table_analytics/useModsTableAnalytics.hook";

const NO_CUSTOM: IModsTableCustomView[] = [];
const NO_CHANGES: IModsTableViewChanges = {};

const viewsState = (state: IState) => state.settings.modsTableViews;

/**
 * The new Mods table's views, and the open one as the user left it: its grouping and columns,
 * which changing saves to it. A built-in view the user changed can go back to its defaults;
 * their own can't, having none. A built-in view that groups keeps to its grouping, which is
 * what it's for. An open view that's no longer offered, such as Updates once there are none,
 * gives way to the first.
 */
export const useModsTableView = (mods: { [id: string]: IModWithState }) => {
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

  const isColumnShown = useCallback(
    (columnId: string) => changes.columns?.[columnId] ?? view.defaults.columns.includes(columnId),
    [changes, view],
  );

  const canReset =
    !view.isCustom &&
    (grouping !== view.defaults.grouping ||
      Object.entries(changes.columns ?? {}).some(
        ([columnId, shown]) => shown !== view.defaults.columns.includes(columnId),
      ));

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

  const reset = useCallback(() => {
    analytics.onViewChanged("reset");
    dispatch(resetModsTableView(view.id));
  }, [analytics, dispatch, view.id]);

  const addView = useCallback(
    (name: string) => {
      const id = `custom-${crypto.randomUUID()}`;
      analytics.onViewChanged("created");
      analytics.onViewSelected({ id, label: name, defaults: NEW_VIEW_DEFAULTS, isCustom: true });
      dispatch(addModsTableView(id, name));
    },
    [analytics, dispatch],
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
    canReset,
    select,
    setGrouping,
    setColumnVisible,
    reset,
    addView,
    renameView,
    removeView,
  };
};
