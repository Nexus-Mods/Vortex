import { act, renderHook } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { Provider } from "react-redux";
import { type AnyAction, createStore } from "redux";
import { describe, expect, it } from "vitest";

import { tableReducer } from "@/reducers/tables";

import { type IModsTableColumn, useModsTableColumns } from "./useModsTableColumns.hook";

const column = (id: string, extra: Partial<IModsTableColumn> = {}): IModsTableColumn => ({
  id,
  header: id,
  cell: () => null,
  ...extra,
});

const COLUMNS = [
  column("name"),
  column("version", { isToggleable: true }),
  column("author", { isToggleable: true, isDefaultVisible: false }),
];

type ITables = typeof tableReducer.defaults;

const makeStore = (tables: ITables = {}) =>
  createStore(
    (state: { settings: { tables: ITables } } = { settings: { tables } }, action: AnyAction) => {
      const reduce = tableReducer.reducers[action.type];
      return reduce
        ? { settings: { tables: reduce(state.settings.tables, action.payload) } }
        : state;
    },
  );

const renderColumns = (tables?: ITables) => {
  const store = makeStore(tables);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  const { result } = renderHook(() => useModsTableColumns(COLUMNS), { wrapper });
  return { result, store };
};

const visibleIds = (columns: IModsTableColumn[]) => columns.map(({ id }) => id);

describe("useModsTableColumns", () => {
  it("shows each column as it says to by default", () => {
    const { result } = renderColumns();

    expect(visibleIds(result.current.visibleColumns)).toEqual(["name", "version"]);
    expect(result.current.canReset).toBe(false);
  });

  it("lists only the toggleable columns to toggle", () => {
    const { result } = renderColumns();

    expect(result.current.toggles).toEqual([
      { id: "version", header: "version", visible: true },
      { id: "author", header: "author", visible: false },
    ]);
  });

  // The legacy table's choices, under the same table id, carry over.
  it("follows the choices stored for the legacy table", () => {
    const { result } = renderColumns({
      mods: { attributes: { version: { enabled: false }, author: { enabled: true } } },
    });

    expect(visibleIds(result.current.visibleColumns)).toEqual(["name", "author"]);
  });

  it("never hides a column that isn't toggleable", () => {
    const { result } = renderColumns({ mods: { attributes: { name: { enabled: false } } } });

    expect(visibleIds(result.current.visibleColumns)).toContain("name");
  });

  it("stores a column shown or hidden, and offers to reset it", () => {
    const { result, store } = renderColumns();

    act(() => result.current.setColumnVisible("author", true));

    expect(store.getState().settings.tables.mods.attributes.author.enabled).toBe(true);
    expect(visibleIds(result.current.visibleColumns)).toEqual(["name", "version", "author"]);
    expect(result.current.canReset).toBe(true);
  });

  it("resets every column to its default", () => {
    const { result } = renderColumns({
      mods: { attributes: { version: { enabled: false }, author: { enabled: true } } },
    });

    act(() => result.current.resetColumns());

    expect(visibleIds(result.current.visibleColumns)).toEqual(["name", "version"]);
    expect(result.current.canReset).toBe(false);
  });
});
