import { describe, expect, it } from "vitest";

import {
  addModsTableView,
  removeModsTableView,
  renameModsTableView,
  resetModsTableView,
  selectModsTableView,
  setModsTableViewColumn,
  setModsTableViewGrouping,
} from "../actions/modsTableViews";
import { type IModsTableViewsState, modsTableViewsReducer } from "./modsTableViews";

const reduce = (state: IModsTableViewsState, action: { type: string; payload: unknown }) =>
  modsTableViewsReducer.reducers[action.type](state, action.payload);

const EMPTY: IModsTableViewsState = { changes: {}, custom: [] };

describe("modsTableViewsReducer", () => {
  it("opens a view", () => {
    expect(reduce(EMPTY, selectModsTableView("status")).selected).toBe("status");
  });

  it("keeps a view's grouping and columns to it", () => {
    let state = reduce(EMPTY, setModsTableViewGrouping("all", "author"));
    state = reduce(state, setModsTableViewColumn("all", "author", true));
    state = reduce(state, setModsTableViewColumn("status", "version", false));

    expect(state.changes).toEqual({
      all: { grouping: "author", columns: { author: true } },
      status: { columns: { version: false } },
    });
  });

  it("forgets what changed about a view on reset, and only that view", () => {
    let state = reduce(EMPTY, setModsTableViewGrouping("all", "author"));
    state = reduce(state, setModsTableViewGrouping("status", "category"));
    state = reduce(state, resetModsTableView("all"));

    expect(state.changes).toEqual({ status: { grouping: "category" } });
  });

  it("adds a view of the user's own, after any others, and opens it", () => {
    let state = reduce(EMPTY, addModsTableView("custom-1", "First"));
    state = reduce(state, addModsTableView("custom-2", "Second"));

    expect(state.custom).toEqual([
      { id: "custom-1", name: "First" },
      { id: "custom-2", name: "Second" },
    ]);
    expect(state.selected).toBe("custom-2");
  });

  it("renames a view of the user's own", () => {
    const state = reduce(
      reduce(EMPTY, addModsTableView("custom-1", "First")),
      renameModsTableView("custom-1", "Renamed"),
    );

    expect(state.custom).toEqual([{ id: "custom-1", name: "Renamed" }]);
  });

  it("deletes a view of the user's own with its changes, back to the first view if it was open", () => {
    let state = reduce(EMPTY, addModsTableView("custom-1", "First"));
    state = reduce(state, setModsTableViewGrouping("custom-1", "author"));
    state = reduce(state, removeModsTableView("custom-1"));

    expect(state).toEqual({ selected: undefined, changes: {}, custom: [] });
  });
});
