import { actionsToReducerSpec } from "@/reducers/builder";

import * as actions from "../actions/modsTableViews";

/** What a user changed about a view, over its defaults; unset, it's as its defaults have it. */
export interface IModsTableViewChanges {
  /** A column's id, or "none". */
  grouping?: string;
  /** Whether each column the user toggled shows, by id. */
  columns?: { [columnId: string]: boolean };
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
  setModsTableViewColumn: (state, { viewId, columnId, visible }) =>
    withChanges(state, viewId, (changes) => ({
      ...changes,
      columns: { ...changes.columns, [columnId]: visible },
    })),
  resetModsTableView: (state, viewId) => {
    const { [viewId]: _reset, ...changes } = state.changes;
    return { ...state, changes };
  },
  addModsTableView: (state, { viewId, name }) => ({
    ...state,
    selected: viewId,
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
