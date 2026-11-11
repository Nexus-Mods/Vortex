import { render, renderHook, screen } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { registered } = vi.hoisted(() => ({ registered: { attributes: [] as unknown[] } }));

vi.mock("@/ExtensionProvider", () => ({
  useExtensionObjects: () => registered.attributes,
}));

import { makeModsTableStore } from "@/test-utils/modsTableStore";
import type { ITableAttribute } from "@/types/ITableAttribute";

import type { IModWithState } from "../../types/IModProps";
import type { IModRow } from "../../util/mods_table_views/modsTableViews";
import type { IModsTableColumn } from "../use_mods_table_columns/useModsTableColumns.hook";
import { useRegisteredModsColumns } from "./useRegisteredModsColumns.hook";

// --- Helpers ---

const attribute = (attr: Partial<ITableAttribute<IModWithState>>): ITableAttribute =>
  ({ id: "extra", name: "Extra", placement: "table", edit: {}, ...attr }) as ITableAttribute;

const row = (mod: object = {}): IModRow => ({
  mod: { id: "a", type: "", attributes: {}, ...mod } as unknown as IModWithState,
  name: "Alpha",
});

const renderRegistered = (ownIds: ReadonlySet<string> = new Set()) => {
  const store = makeModsTableStore();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return renderHook(() => useRegisteredModsColumns(ownIds), { wrapper }).result.current;
};

const cellText = (column: IModsTableColumn, modRow: IModRow = row()) =>
  render(<>{column.cell(modRow)}</>).container.textContent;

// --- Tests ---

describe("useRegisteredModsColumns", () => {
  beforeEach(() => {
    registered.attributes = [];
  });

  it("offers a column an extension registers to toggle, headed by its name, showing its value", () => {
    registered.attributes = [
      attribute({ id: "endorsed", name: "Endorsed", calc: (mod) => mod.attributes?.endorsed }),
    ];

    const { columns } = renderRegistered();

    expect(columns).toHaveLength(1);
    expect(columns[0]).toMatchObject({ id: "endorsed", header: "Endorsed", isToggleable: true });
    expect(cellText(columns[0], row({ attributes: { endorsed: "Endorsed" } }))).toBe("Endorsed");
  });

  it("leaves out attributes shown only in the details pane or inline", () => {
    registered.attributes = [
      attribute({ id: "table", placement: "table" }),
      attribute({ id: "both", placement: "both" }),
      attribute({ id: "detail", placement: "detail" }),
      attribute({ id: "inline", placement: "inline" }),
    ];

    expect(renderRegistered().columns.map(({ id }) => id)).toEqual(["table", "both"]);
  });

  // Category, Mod type, Source and Collection are the table's own, which sort, group and search.
  it("leaves out a column the table already has, so none shows twice", () => {
    registered.attributes = [attribute({ id: "category" }), attribute({ id: "endorsed" })];

    const { columns } = renderRegistered(new Set(["category"]));

    expect(columns.map(({ id }) => id)).toEqual(["endorsed"]);
  });

  // As a game's own columns say which game they're for.
  it("offers a column only while its condition holds, asking again when the game changes", () => {
    let game = "stardewvalley";
    registered.attributes = [attribute({ id: "sdv", condition: () => game === "stardewvalley" })];

    let store = makeModsTableStore({ gameId: "skyrimse" });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const ownIds = new Set<string>();
    const { result, rerender } = renderHook(() => useRegisteredModsColumns(ownIds), { wrapper });
    expect(result.current.columns.map(({ id }) => id)).toEqual(["sdv"]);

    game = "skyrimse";
    store = makeModsTableStore({ gameId: "skyrimse2" });
    rerender();

    expect(result.current.columns).toEqual([]);
  });

  it("keeps its position, which places it among the table's own", () => {
    registered.attributes = [attribute({ id: "loadOrder", position: 30 }), attribute({})];

    const { columns } = renderRegistered();

    expect(columns.map(({ position }) => position)).toEqual([30, undefined]);
  });

  // As in the legacy table, a column is shown unless it says not to be.
  it("names the columns to show until the user hides them", () => {
    registered.attributes = [
      attribute({ id: "endorsed" }),
      attribute({ id: "tracked", isDefaultVisible: false }),
      attribute({ id: "content", isDefaultVisible: true }),
      attribute({ id: "category" }),
    ];

    const { defaultShown } = renderRegistered(new Set(["category"]));

    expect(defaultShown).toEqual(["endorsed", "content"]);
  });

  describe("a value", () => {
    const shown = (value: unknown) => {
      registered.attributes = [attribute({ calc: () => value })];
      return renderRegistered().columns[0];
    };

    it("shows text and numbers as they are, and a list of them as one line", () => {
      expect(cellText(shown("Optional"))).toBe("Optional");
      expect(cellText(shown(42))).toBe("42");
      expect(cellText(shown(["Textures", "Meshes"]))).toBe("Textures, Meshes");
    });

    it("shows a date in the user's language", () => {
      const date = new Date(2026, 10, 11, 9, 30);

      expect(cellText(shown(date))).toBe(date.toLocaleString("en"));
    });

    it("shows nothing for none, or for an object with no text to show", () => {
      expect(cellText(shown(undefined))).toBe("");
      expect(cellText(shown(null))).toBe("");
      expect(cellText(shown({ status: "ok" }))).toBe("");
    });

    it("marks a true value with a tick named by the column, and a false one with nothing", () => {
      render(<>{shown(true).cell(row())}</>);
      expect(screen.getByRole("img", { name: "Extra" })).toBeInTheDocument();

      expect(render(<>{shown(false).cell(row())}</>).container).toBeEmptyDOMElement();
    });
  });
});
