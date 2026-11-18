import { actionsToReducerSpec } from "@/reducers/builder";
import type { ITableSort } from "@/ui/components/table/Table.types";

import * as actions from "../actions/modsTableViews";
import type { IModsTableFilters } from "../util/mods_table_filters/modsTableFilters";

/** What a user changed about a view, over its defaults; unset, it's as its defaults have it. */
export interface IModsTableViewChanges {
  /** The column the mods are sorted by, and which way. */
  sort?: ITableSort;
  /** A column's id, or "none". */
  grouping?: string;
  /** Whether each column the user toggled shows, by id. */
  columns?: { [columnId: string]: boolean };
  /** The filters the user set; unset ones are as the view's defaults have them. */
  filters?: Partial<IModsTableFilters>;
  /** The width in px of each column the user resized, by id; a reset keeps them. */
  widths?: { [columnId: string]: number };
}

/** A view the user made, which starts from the new view defaults. */
export interface IModsTableCustomView {
  id: string;
  name: string;
}

/** The new Mods table's views: which is open, what's changed about each, and the user's own. */
export interface IModsTableViewsState {
  /** The open view; unset, the first. */
  selected?: string;
  /** By view id, built-in or the user's own. */
  changes: { [viewId: string]: IModsTableViewChanges };
  /** In the order they were made. */
  custom: IModsTableCustomView[];
}

declare module "@/types/IState" {
  interface ISettings {
    modsTableViews: IModsTableViewsState;
  }
}

const defaultState: IModsTableViewsState = {
  changes: {},
  custom: [],
};

const withChanges = (
  state: IModsTableViewsState,
  viewId: string,
  update: (changes: IModsTableViewChanges) => IModsTableViewChanges,
): IModsTableViewsState => ({
  ...state,
  changes: { ...state.changes, [viewId]: update(state.changes[viewId] ?? {}) },
});

export const modsTableViewsReducer = actionsToReducerSpec(defaultState, actions, {
  selectModsTableView: (state, viewId) => ({ ...state, selected: viewId }),
  setModsTableViewGrouping: (state, { viewId, grouping }) =>
    withChanges(state, viewId, (changes) => ({ ...changes, grouping })),
  setModsTableViewSort: (state, { viewId, sort }) =>
    withChanges(state, viewId, (changes) => ({ ...changes, sort })),
  setModsTableViewFilters: (state, { viewId, filters }) =>
    withChanges(state, viewId, (changes) => ({
      ...changes,
      filters: { ...changes.filters, ...filters },
    })),
  resetModsTableViewFilters: (state, { viewId, keys }) =>
    withChanges(state, viewId, ({ filters, ...changes }) => {
      const kept = Object.fromEntries(
        Object.entries(filters ?? {}).filter(
          ([key]) => !!keys && !keys.includes(key as keyof IModsTableFilters),
        ),
      );
      return Object.keys(kept).length ? { ...changes, filters: kept } : changes;
    }),
  setModsTableViewColumn: (state, { viewId, columnId, visible }) =>
    withChanges(state, viewId, (changes) => ({
      ...changes,
      columns: { ...changes.columns, [columnId]: visible },
    })),
  setModsTableViewColumnWidths: (state, { viewId, widths }) =>
    withChanges(state, viewId, (changes) => {
      const next = { ...changes.widths };
      for (const [columnId, width] of Object.entries(widths)) {
        if (width === undefined) {
          delete next[columnId];
        } else {
          next[columnId] = width;
        }
      }
      return { ...changes, widths: next };
    }),
  resetModsTableView: (state, viewId) => {
    const { [viewId]: reset, ...changes } = state.changes;
    const { grouping: _grouping, ...kept } = reset ?? {};
    return Object.keys(kept).length
      ? { ...state, changes: { ...changes, [viewId]: kept } }
      : { ...state, changes };
  },
  addModsTableView: (state, { viewId, name, changes }) => ({
    ...state,
    selected: viewId,
    changes: { ...state.changes, [viewId]: changes },
    custom: [...state.custom, { id: viewId, name }],
  }),
  renameModsTableView: (state, { viewId, name }) => ({
    ...state,
    custom: state.custom.map((view) => (view.id === viewId ? { ...view, name } : view)),
  }),
  // Back to the first view if it was open.
  removeModsTableView: (state, viewId) => {
    const { [viewId]: _removed, ...changes } = state.changes;
    return {
      selected: state.selected === viewId ? undefined : state.selected,
      changes,
      custom: state.custom.filter((view) => view.id !== viewId),
    };
  },
});
