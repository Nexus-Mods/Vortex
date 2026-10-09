import { render, renderHook } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { makeModsTableStore } from "@/test-utils/modsTableStore";

vi.mock("../../util/modSource", () => ({
  getModSources: () => [{ id: "nexus", name: "Nexus Mods" }],
}));

vi.mock("../../../gamemode_management/util/modTypeExtensions", () => ({
  getModType: (id: string) =>
    id === "dinput" ? { options: { name: "Engine injector" } } : undefined,
}));

import type { IMod } from "../../types/IMod";
import type { IModWithState } from "../../types/IModProps";
import type { IModRow } from "../../util/mods_table_views/modsTableViews";
import type { IModsTableColumn } from "../use_mods_table_columns/useModsTableColumns.hook";
import { useModsTableDataColumns } from "./useModsTableDataColumns.hook";

const row = (mod: object): IModRow => ({
  mod: { id: "a", type: "", attributes: {}, ...mod } as unknown as IModWithState,
  name: "Alpha",
});

const collection = (name: string) => ({ id: name, attributes: { name } }) as unknown as IMod;

const renderColumns = (memberships: { [modId: string]: IMod[] } = {}) => {
  const store = makeModsTableStore({
    downloads: { archive: { localPath: "alpha-1.0.zip", fileTime: Date.now() - 60_000 } },
    categories: { "95": { name: "Armour", parentCategory: undefined, order: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return renderHook(() => useModsTableDataColumns(memberships), { wrapper }).result.current;
};

const columnById = (columns: IModsTableColumn[], id: string) =>
  columns.find((column) => column.id === id)!;

const cellText = (column: IModsTableColumn, modRow: IModRow) =>
  render(<>{column.cell(modRow)}</>).container.textContent;

describe("useModsTableDataColumns", () => {
  // The legacy table's ids and order, so the two share the user's column choices.
  it("offers its columns to toggle, in the legacy table's order", () => {
    const columns = renderColumns();

    expect(columns.map(({ id }) => id)).toEqual([
      "author",
      "archiveName",
      "category",
      "modType",
      "modSource",
      "collection",
      "installTime",
      "enabledTime",
      "downloadTime",
    ]);
    expect(columns.every(({ isToggleable }) => isToggleable)).toBe(true);
  });

  it("shows only the installation time and collection by default", () => {
    const shown = renderColumns().filter(({ isDefaultVisible }) => isDefaultVisible);

    expect(shown.map(({ id }) => id)).toEqual(["collection", "installTime"]);
  });

  it("shows the mod's own values", () => {
    const columns = renderColumns();
    const modRow = row({ type: "dinput", attributes: { author: "Ada", source: "nexus" } });

    expect(cellText(columnById(columns, "author"), modRow)).toBe("Ada");
    expect(cellText(columnById(columns, "modType"), modRow)).toBe("Engine injector");
    expect(cellText(columnById(columns, "modSource"), modRow)).toBe("Nexus Mods");
  });

  it("shows its download's archive name and when it was downloaded", () => {
    const columns = renderColumns();
    const modRow = row({ archiveId: "archive" });

    expect(cellText(columnById(columns, "archiveName"), modRow)).toBe("alpha-1.0.zip");
    expect(cellText(columnById(columns, "downloadTime"), modRow)).toMatch(/minute/);
  });

  // A mod's category can hold several ids; the legacy table names the first.
  it("names the mod's first category, for the active game", () => {
    const columns = renderColumns();

    expect(
      cellText(columnById(columns, "category"), row({ attributes: { category: "95,1704" } })),
    ).toBe("Armour");
  });

  it("says when a time isn't known", () => {
    const columns = renderColumns();
    const modRow = row({});

    expect(cellText(columnById(columns, "installTime"), modRow)).toBe("Not installed");
    expect(cellText(columnById(columns, "enabledTime"), modRow)).toBe("Never");
    expect(cellText(columnById(columns, "downloadTime"), modRow)).toBe("Unknown");
  });

  // A search matches what's on screen, so each column searches by the text its cell shows.
  it("searches each column by the text its cell shows", () => {
    const columns = renderColumns();
    const modRow = row({ archiveId: "archive", attributes: { author: "Gervig" } });

    columns.forEach((column) => {
      expect(column.searchText?.(modRow)).toBe(cellText(column, modRow));
    });
  });

  it("names the collections a mod came from, by name", () => {
    const columns = renderColumns({ a: [collection("Zeta"), collection("Beta")] });

    expect(cellText(columnById(columns, "collection"), row({}))).toBe("Beta, Zeta");
  });

  it("sorts times oldest first, with unknown times before any", () => {
    const sort = columnById(renderColumns(), "enabledTime").sort!;
    const rows = [row({ enabledTime: 2000 }), row({}), row({ enabledTime: 1000 })];

    expect([...rows].sort(sort).map(({ mod }) => mod.enabledTime)).toEqual([undefined, 1000, 2000]);
  });
});
