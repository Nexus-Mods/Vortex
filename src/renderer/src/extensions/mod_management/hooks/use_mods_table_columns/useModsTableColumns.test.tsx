import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
  column("author", { isToggleable: true }),
];

const renderColumns = (columns: IModsTableColumn[], shown: string[] = []) =>
  renderHook(() => useModsTableColumns(columns, (columnId) => shown.includes(columnId))).result;

const visibleIds = (columns: IModsTableColumn[]) => columns.map(({ id }) => id);

describe("useModsTableColumns", () => {
  it("shows the toggleable columns the view shows, and every other", () => {
    const result = renderColumns(COLUMNS, ["version"]);

    expect(visibleIds(result.current.visibleColumns)).toEqual(["name", "version"]);
  });

  it("lists only the toggleable columns to toggle, with whether each shows", () => {
    const result = renderColumns(COLUMNS, ["version"]);

    expect(result.current.toggles).toEqual([
      { id: "version", header: "version", visible: true },
      { id: "author", header: "author", visible: false },
    ]);
  });

  it("never hides a column that isn't toggleable", () => {
    const result = renderColumns(COLUMNS);

    expect(visibleIds(result.current.visibleColumns)).toEqual(["name"]);
  });

  // As the legacy table orders its attributes; the first column stays first.
  it("orders the toggleable columns by position, between the fixed and the sticky ones", () => {
    const columns = [
      column("status", { sticky: "end" }),
      column("late", { isToggleable: true, position: 110 }),
      column("name", { position: 200 }),
      column("unplaced", { isToggleable: true }),
      column("early", { isToggleable: true, position: 50 }),
      column("tied", { isToggleable: true, position: 100 }),
    ];

    const result = renderColumns(columns, ["late", "unplaced", "early", "tied"]);

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
    const groupBy = () => "";
    const columns = [
      column("name"),
      column("status", { sticky: "end", groupBy }),
      column("hidden", { isToggleable: true, position: 60, groupBy }),
      column("shown", { isToggleable: true, position: 50, groupBy }),
      column("ungroupable", { isToggleable: true, position: 40 }),
    ];

    const result = renderColumns(columns, ["shown"]);

    expect(result.current.groupable.map(({ id }) => id)).toEqual(["shown", "hidden", "status"]);
  });

  it("names a column in the group options by its group label, where it has one", () => {
    const groupBy = () => "";
    const columns = [
      column("status", { header: "Actions", groupLabel: "Status", groupBy }),
      column("author", { header: "Author", groupBy }),
    ];

    const result = renderColumns(columns);

    expect(result.current.groupable.map(({ header }) => header)).toEqual(["Status", "Author"]);
    expect(result.current.visibleColumns.map(({ header }) => header)).toEqual([
      "Actions",
      "Author",
    ]);
  });
});
