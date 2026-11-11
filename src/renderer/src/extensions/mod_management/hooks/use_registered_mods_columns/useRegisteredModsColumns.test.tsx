import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { registered } = vi.hoisted(() => ({ registered: { attributes: [] as unknown[] } }));

vi.mock("@/ExtensionProvider", () => ({
  useExtensionObjects: () => registered.attributes,
}));

// The gate attaches an extension's reactive props, and its fallback needs the app's icon files;
// the tests see only which gate a cell is drawn in.
vi.mock("@/controls/ExtensionGate", () => ({
  default: ({ id, children }: { id: string; children: React.ReactNode }) => (
    <div data-testid={`gate-${id}`}>{children}</div>
  ),
}));

// The same `t` on every render, as the app's is until the language changes, so a redraw
// alone doesn't work a value out again. The shared stub makes a new one each time.
vi.mock("react-i18next", async (importOriginal) => {
  const t = (key: string) => key;
  return {
    ...(await importOriginal<object>()),
    useTranslation: () => Object.assign([t, undefined, true], { t, i18n: undefined, ready: true }),
  };
});

import { makeModsTableStore } from "@/test-utils/modsTableStore";
import type { ITableAttribute } from "@/types/ITableAttribute";

import type { IModWithState } from "../../types/IModProps";
import type { IModRow } from "../../util/mods_table_views/modsTableViews";
import type { IModsTableColumn } from "../use_mods_table_columns/useModsTableColumns.hook";
import { useRegisteredModsColumns } from "./useRegisteredModsColumns.hook";

// --- Helpers ---

// Toggleable, as most extensions' columns are.
const attribute = (attr: Partial<ITableAttribute<IModWithState>>): ITableAttribute =>
  ({
    id: "extra",
    name: "Extra",
    placement: "table",
    isToggleable: true,
    edit: {},
    ...attr,
  }) as ITableAttribute;

const row = (mod: object = {}): IModRow => ({
  mod: { id: "a", type: "", attributes: {}, ...mod } as unknown as IModWithState,
  name: "Alpha",
});

type Mods = { [id: string]: IModWithState };

const NO_MODS: Mods = {};

const renderRegistered = (ownIds: ReadonlySet<string> = new Set()) => {
  const store = makeModsTableStore();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return renderHook(() => useRegisteredModsColumns(ownIds, NO_MODS), { wrapper }).result.current;
};

const cellText = (column: IModsTableColumn, modRow: IModRow = row()) =>
  render(<>{column.cell(modRow)}</>).container.textContent;

const NO_IDS = new Set<string>();

/** The first registered column's cell for a row, as the table draws it while the mods change. */
const CellHarness = ({ modRow, mods }: { modRow: IModRow; mods: Mods }) => {
  const { columns } = useRegisteredModsColumns(NO_IDS, mods);
  return <div data-testid="cell">{columns[0].cell(modRow)}</div>;
};

/** Renders a registered column's cell, and draws it again as the table would. */
const renderCell = (modRow: IModRow = row()) => {
  const store = makeModsTableStore();
  const view = render(
    <Provider store={store}>
      <CellHarness modRow={modRow} mods={NO_MODS} />
    </Provider>,
  );
  return {
    cell: () => screen.getByTestId("cell"),
    /** Draws it again, for these mods, as the table does when any of them changes. */
    redraw: (mods: Mods = NO_MODS) =>
      view.rerender(
        <Provider store={store}>
          <CellHarness modRow={modRow} mods={mods} />
        </Provider>,
      ),
  };
};

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
    const { result, rerender } = renderHook(() => useRegisteredModsColumns(ownIds, NO_MODS), {
      wrapper,
    });
    expect(result.current.columns.map(({ id }) => id)).toEqual(["sdv"]);

    game = "skyrimse";
    store = makeModsTableStore({ gameId: "skyrimse2" });
    rerender();

    expect(result.current.columns).toEqual([]);
  });

  it("keeps its position, or the legacy default, which places it among the table's own", () => {
    registered.attributes = [attribute({ id: "loadOrder", position: 30 }), attribute({})];

    const { columns } = renderRegistered();

    expect(columns.map(({ position }) => position)).toEqual([30, 100]);
  });

  // As the legacy table shows a game's Compatibility column, which says nothing of toggling.
  it("always shows a column the user can't toggle, if it's shown by default", () => {
    registered.attributes = [attribute({ id: "sdv-compatibility", isToggleable: undefined })];

    const { columns, defaultShown } = renderRegistered();

    expect(columns).toMatchObject([{ id: "sdv-compatibility", isToggleable: false }]);
    expect(defaultShown).toEqual([]);
  });

  // As the script extender's Extender Error, which its extension shows itself (LAZ-1579).
  it("leaves out a column the user can't toggle that's hidden by default", () => {
    registered.attributes = [
      attribute({
        id: "script-extender-error-check",
        isToggleable: false,
        isDefaultVisible: false,
      }),
    ];

    const { columns, defaultShown } = renderRegistered();

    expect(columns).toEqual([]);
    expect(defaultShown).toEqual([]);
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

  // As the legacy table asks every attribute, the table's own columns and those not in it too.
  it("gives a row the classes extensions add to it, telling each whether its column is shown", () => {
    const highlight = vi.fn((_mod: IModWithState, enabled: boolean) =>
      enabled ? "highlighted" : undefined,
    );
    registered.attributes = [
      attribute({ id: "modType", cssClass: (mod) => `mod-modtype-${mod.type}` }),
      attribute({ id: "modHighlight", cssClass: highlight }),
      attribute({ id: "notes", placement: "detail", cssClass: () => "has-notes" }),
      attribute({ id: "plain" }),
    ];

    const { rowClassName } = renderRegistered(new Set(["modType"]));
    const collectionRow = row({ type: "collection" });

    expect(rowClassName(collectionRow, (id) => id === "modHighlight")).toBe(
      "mod-modtype-collection highlighted has-notes",
    );
    expect(rowClassName(collectionRow, () => false)).toBe("mod-modtype-collection has-notes");
    expect(highlight).toHaveBeenLastCalledWith(collectionRow.mod, false);
  });

  // As the legacy table tells one that isn't a column whether it would be shown by default.
  it("tells an attribute that isn't a column here it's shown, unless it's hidden by default", () => {
    const cssClass = vi.fn((_mod: IModWithState, _enabled: boolean) => "");
    registered.attributes = [
      attribute({ id: "notes", placement: "detail", cssClass }),
      attribute({ id: "sdv", condition: () => false, isDefaultVisible: false, cssClass }),
    ];

    renderRegistered().rowClassName(row(), () => false);

    expect(cssClass.mock.calls.map(([, enabled]) => enabled)).toEqual([true, false]);
  });

  it("tells a column the user can't toggle whether it's shown by default, whatever the view", () => {
    const cssClass = vi.fn((_mod: IModWithState, _enabled: boolean) => "");
    registered.attributes = [
      attribute({ id: "fixed", isToggleable: false, cssClass }),
      attribute({ id: "error", isToggleable: false, isDefaultVisible: false, cssClass }),
    ];

    renderRegistered().rowClassName(row(), () => false);

    expect(cssClass.mock.calls.map(([, enabled]) => enabled)).toEqual([true, false]);
  });

  it("gives a row no classes when no extension adds any", () => {
    registered.attributes = [attribute({ id: "plain" })];

    expect(renderRegistered().rowClassName(row(), () => true)).toBeUndefined();
  });

  describe("a cell of the extension's own", () => {
    it("is drawn by its renderer, given the mod, in place of the value", () => {
      const customRenderer = vi.fn((mod: IModWithState) => (
        <button type="button">{`Endorse ${mod.id}`}</button>
      ));
      registered.attributes = [attribute({ calc: () => "Undecided", customRenderer })];

      const { cell } = renderCell();

      expect(within(cell()).getByRole("button", { name: "Endorse a" })).toBeInTheDocument();
      expect(cell()).not.toHaveTextContent("Undecided");
      expect(customRenderer).toHaveBeenCalledWith(
        expect.objectContaining({ id: "a" }),
        false,
        expect.any(Function),
        expect.objectContaining({ onHighlight: expect.any(Function) }),
      );
    });

    // As in the legacy table, by the same id, so a broken control shows the gate's warning.
    it("is drawn in the extension gate for its mod and column", () => {
      registered.attributes = [
        attribute({ id: "endorsed", customRenderer: () => <button type="button">Endorse</button> }),
      ];

      const { cell } = renderCell();

      expect(
        within(within(cell()).getByTestId("gate-extension-a-endorsed")).getByRole("button"),
      ).toBeInTheDocument();
    });

    // A renderer that throws as it's called, which in the legacy table takes the page down.
    it("draws nothing when its renderer fails", () => {
      registered.attributes = [
        attribute({
          customRenderer: () => {
            throw new Error("broken");
          },
        }),
      ];

      expect(renderCell().cell()).toBeEmptyDOMElement();
    });

    // Such as the Dependencies column, whose rules the dependency manager keeps outside the mods.
    it("is drawn again when the extension says the data it's from changed", () => {
      let label = "No rules";
      let changed = () => {};
      registered.attributes = [
        attribute({
          customRenderer: () => <span>{label}</span>,
          externalData: (onChanged) => {
            changed = onChanged;
          },
        }),
      ];
      const { cell } = renderCell();
      expect(cell()).toHaveTextContent("No rules");

      label = "1 rule";
      act(() => changed());

      expect(cell()).toHaveTextContent("1 rule");
    });

    it("draws nothing, in no gate, when its renderer draws nothing", () => {
      registered.attributes = [attribute({ customRenderer: () => null })];

      expect(renderCell().cell()).toBeEmptyDOMElement();
    });

    // As `shown && <Control />` gives, which the gate would take for a broken control.
    it.each([false, "", 0])("draws nothing, in no gate, when its renderer gives %j", (drawn) => {
      registered.attributes = [
        attribute({ customRenderer: () => drawn as unknown as JSX.Element }),
      ];

      expect(renderCell().cell()).toBeEmptyDOMElement();
    });
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

    it("shows a value worked out asynchronously once it's ready", async () => {
      registered.attributes = [attribute({ calc: () => Promise.resolve("Compatible") })];

      const { cell } = renderCell();

      await waitFor(() => expect(cell()).toHaveTextContent("Compatible"));
    });

    it("ignores one worked out asynchronously that a later one has replaced", async () => {
      const resolvers: Array<(value: string) => void> = [];
      registered.attributes = [
        attribute({
          isVolatile: true,
          calc: () => new Promise<string>((resolve) => resolvers.push(resolve)),
        }),
      ];
      const { cell, redraw } = renderCell();
      redraw({ b: row({ id: "b" }).mod });

      await act(async () => resolvers[1]("Current"));
      await act(async () => resolvers[0]("Stale"));

      expect(cell()).toHaveTextContent("Current");
    });

    // As the legacy table logs it and carries on, an extension's bug doesn't take the table down.
    it("shows nothing for one that fails to be worked out", () => {
      registered.attributes = [
        attribute({
          calc: () => {
            throw new Error("broken");
          },
        }),
      ];

      expect(renderCell().cell()).toBeEmptyDOMElement();
    });

    it("shows nothing for one that fails to be worked out asynchronously", async () => {
      registered.attributes = [attribute({ calc: () => Promise.reject(new Error("broken")) })];

      const { cell } = renderCell();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(cell()).toBeEmptyDOMElement();
    });

    // Such as the Deploy order, which the dependency manager keeps outside the mods.
    it("is worked out again when the extension says the data it's from changed", () => {
      let order = 1;
      let changed = () => {};
      registered.attributes = [
        attribute({
          calc: () => order,
          externalData: (onChanged) => {
            changed = onChanged;
          },
        }),
      ];
      const { cell, redraw } = renderCell();
      expect(cell()).toHaveTextContent("1");

      order = 2;
      redraw({ b: row({ id: "b" }).mod });
      expect(cell()).toHaveTextContent("1");

      act(() => changed());
      expect(cell()).toHaveTextContent("2");
    });

    // Some extensions keep only the last listener, which the legacy table needs while it's shown.
    it("isn't listened for while the new table isn't the one shown", () => {
      const externalData = vi.fn();
      registered.attributes = [attribute({ externalData })];
      const store = makeModsTableStore({ betaTable: false });
      const wrapper = ({ children }: { children: ReactNode }) => (
        <Provider store={store}>{children}</Provider>
      );

      renderHook(() => useRegisteredModsColumns(NO_IDS, NO_MODS), { wrapper });

      expect(externalData).not.toHaveBeenCalled();
    });

    // As one worked out from other mods than its own, which the legacy table works out again
    // whenever the mods change.
    it("is worked out again when any mod changes, if it says it's volatile", () => {
      let count = 1;
      registered.attributes = [attribute({ calc: () => count, isVolatile: true })];
      const { cell, redraw } = renderCell();

      count = 2;
      redraw({ b: row({ id: "b" }).mod });

      expect(cell()).toHaveTextContent("2");
    });

    it("marks a true value with a tick named by the column, and a false one with nothing", () => {
      render(<>{shown(true).cell(row())}</>);
      expect(screen.getByRole("img", { name: "Extra" })).toBeInTheDocument();

      expect(render(<>{shown(false).cell(row())}</>).container).toBeEmptyDOMElement();
    });
  });
});
