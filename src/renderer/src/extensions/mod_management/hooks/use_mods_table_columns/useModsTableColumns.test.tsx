import { act, renderHook } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { type IModsTableTestTables, makeModsTableStore } from "@/test-utils/modsTableStore";

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

const renderColumns = (tables?: IModsTableTestTables) => {
  const store = makeModsTableStore({ tables });
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

  // As the legacy table orders its attributes; the first column stays first.
  it("orders the toggleable columns by position, between the fixed and the sticky ones", () => {
    const store = makeModsTableStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const columns = [
      column("status", { sticky: "end" }),
      column("late", { isToggleable: true, position: 110 }),
      column("name", { position: 200 }),
      column("unplaced", { isToggleable: true }),
      column("early", { isToggleable: true, position: 50 }),
      column("tied", { isToggleable: true, position: 100 }),
    ];

    const { result } = renderHook(() => useModsTableColumns(columns), { wrapper });

    expect(visibleIds(result.current.visibleColumns)).toEqual([
      "name",
      "early",
      "unplaced",
      "tied",
      "late",
      "status",
    ]);
    expect(result.current.toggles.map(({ id }) => id)).toEqual([
      "early",
      "unplaced",
      "tied",
      "late",
    ]);
  });

  it("offers the columns that can group, hidden or not, in the table's order", () => {
    const store = makeModsTableStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const groupBy = () => "";
    const columns = [
      column("name"),
      column("status", { sticky: "end", groupBy }),
      column("hidden", { isToggleable: true, isDefaultVisible: false, position: 60, groupBy }),
      column("shown", { isToggleable: true, position: 50, groupBy }),
      column("ungroupable", { isToggleable: true, position: 40 }),
    ];

    const { result } = renderHook(() => useModsTableColumns(columns), { wrapper });

    expect(result.current.groupable.map(({ id }) => id)).toEqual(["shown", "hidden", "status"]);
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
