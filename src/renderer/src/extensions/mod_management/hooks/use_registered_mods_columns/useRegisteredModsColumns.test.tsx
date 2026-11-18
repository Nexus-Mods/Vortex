import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { createRoot } from "react-dom/client";
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

import { VortexGameId } from "@vortex/shared";

import { setAttributeVisible } from "@/actions/tables";
import { makeModsTableStore } from "@/test-utils/modsTableStore";
import type { ITableAttribute } from "@/types/ITableAttribute";

import type { IModWithState } from "../../types/IModProps";
import type { IModRow } from "../../util/mods_table_views/modsTableViews";
import type { IModsTableColumn } from "../use_mods_table_columns/useModsTableColumns.hook";
import {
  RegisteredModsInputsProvider,
  useRegisteredModsColumns,
} from "./useRegisteredModsColumns.hook";

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

const storeWrapper =
  (store = makeModsTableStore()) =>
  ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;

const renderRegistered = (ownIds: ReadonlySet<string> = new Set()) =>
  renderHook(() => useRegisteredModsColumns(ownIds, NO_MODS, true), { wrapper: storeWrapper() })
    .result.current;

const cellText = (column: IModsTableColumn, modRow: IModRow = row()) =>
  render(<>{column.cell(modRow)}</>).container.textContent;

const NO_IDS = new Set<string>();

/** The first registered column's cell for a row, as the table draws it while the mods change. */
const CellHarness = ({ modRow, mods }: { modRow: IModRow; mods: Mods }) => {
  const { columns, inputs } = useRegisteredModsColumns(NO_IDS, mods, true);
  return (
    <RegisteredModsInputsProvider value={inputs}>
      <div data-testid="cell">{columns[0].cell(modRow)}</div>
    </RegisteredModsInputsProvider>
  );
};

/** The mods, the row's own among them, as the table's always are. */
const withOwn = (modRow: IModRow, others: Mods = NO_MODS): Mods => ({
  ...others,
  [modRow.mod.id]: modRow.mod,
});

/** Renders a registered column's cell, and draws it again as the table would. */
const renderCell = (modRow: IModRow = row()) => {
  const store = makeModsTableStore();
  const view = render(
    <Provider store={store}>
      <CellHarness modRow={modRow} mods={withOwn(modRow)} />
    </Provider>,
  );
  return {
    cell: () => screen.getByTestId("cell"),
    /** Draws it again, beside these other mods, as the table does when any mod changes. */
    redraw: (others: Mods, drawn: IModRow = modRow) =>
      view.rerender(
        <Provider store={store}>
          <CellHarness modRow={drawn} mods={withOwn(drawn, others)} />
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

    let store = makeModsTableStore({ gameId: VortexGameId("skyrimse") });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const ownIds = new Set<string>();
    const { result, rerender } = renderHook(() => useRegisteredModsColumns(ownIds, NO_MODS, true), {
      wrapper,
    });
    expect(result.current.columns.map(({ id }) => id)).toEqual(["sdv"]);

    game = "skyrimse";
    store = makeModsTableStore({ gameId: VortexGameId("skyrimse2") });
    rerender();

    expect(result.current.columns).toEqual([]);
  });

  it("keeps its position, or the legacy default, which places it among the table's own", () => {
    registered.attributes = [attribute({ id: "loadOrder", position: 30 }), attribute({})];

    const { columns } = renderRegistered();

    expect(columns.map(({ position }) => position)).toEqual([30, 100]);
  });

  // Most show an icon or two, so they start as narrow as their header, not as wide as Name.
  it("starts narrow, at a width its header fits in", () => {
    registered.attributes = [attribute({ id: "endorsed" }), attribute({ id: "content" })];

    const { columns } = renderRegistered();

    expect(columns.map(({ width }) => width)).toEqual(["96px", "96px"]);
  });

  // As the legacy table shows a game's Compatibility column, which says nothing of toggling.
  it("always shows a column the user can't toggle, if it's shown by default", () => {
    registered.attributes = [attribute({ id: "sdv-compatibility", isToggleable: undefined })];

    const { columns, defaultShown } = renderRegistered();

    expect(columns).toMatchObject([{ id: "sdv-compatibility", isToggleable: false }]);
    expect(defaultShown).toEqual([]);
  });

  // As the script extender's Extender Error, which its extension shows itself.
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

  // As the script extender shows Extender Error while the game's log has load errors.
  it("shows a column the user can't toggle while its extension says to, as the legacy table does", () => {
    const errorColumn = attribute({
      id: "script-extender-error-check",
      isToggleable: false,
      isDefaultVisible: false,
      cssClass: (_mod, enabled) => (enabled ? "has-error-column" : undefined),
    });
    registered.attributes = [errorColumn];
    const store = makeModsTableStore();
    const { result } = renderHook(() => useRegisteredModsColumns(NO_IDS, NO_MODS, true), {
      wrapper: storeWrapper(store),
    });

    act(() => {
      store.dispatch(setAttributeVisible("mods", "script-extender-error-check", true));
    });

    expect(result.current.columns).toMatchObject([
      { id: "script-extender-error-check", isToggleable: false },
    ]);
    expect(result.current.defaultShown).toEqual([]);
    expect(result.current.rowClassName(row(), () => false)).toBe("has-error-column");

    act(() => {
      store.dispatch(setAttributeVisible("mods", "script-extender-error-check", false));
    });

    expect(result.current.columns).toEqual([]);
    expect(result.current.rowClassName(row(), () => true)).toBeUndefined();
  });

  it("leaves out a column the user can't toggle once its extension hides it", () => {
    registered.attributes = [attribute({ id: "fixed", isToggleable: false })];
    const store = makeModsTableStore({
      tables: { mods: { attributes: { fixed: { enabled: false } } } },
    });

    const { result } = renderHook(() => useRegisteredModsColumns(NO_IDS, NO_MODS, true), {
      wrapper: storeWrapper(store),
    });

    expect(result.current.columns).toEqual([]);
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

  // So a download's progress or a mod being enabled doesn't rebuild the view's columns.
  it("keeps its columns, and the ones to show, when the mods change", () => {
    registered.attributes = [attribute({ id: "endorsed", isVolatile: true })];
    let mods = NO_MODS;
    const ownIds = new Set<string>();
    const { result, rerender } = renderHook(() => useRegisteredModsColumns(ownIds, mods, true), {
      wrapper: storeWrapper(),
    });
    const before = result.current;

    mods = { b: row({ id: "b" }).mod };
    rerender();

    expect(result.current.columns).toBe(before.columns);
    expect(result.current.defaultShown).toBe(before.defaultShown);
    expect(result.current.inputs).not.toBe(before.inputs);
  });

  // Over a long session, the values of mods since removed would otherwise add up.
  it("forgets a mod's values once the mod is gone", () => {
    const calc = vi.fn(() => "Textures");
    registered.attributes = [attribute({ calc })];
    const alpha = row();
    const beta = row({ id: "b" });
    let mods: Mods = { a: alpha.mod, b: beta.mod };
    const { result, rerender } = renderHook(() => useRegisteredModsColumns(NO_IDS, mods, true), {
      wrapper: storeWrapper(),
    });
    const searchBeta = () => result.current.columns[0].searchText?.(beta);

    searchBeta();
    mods = { a: alpha.mod };
    rerender();
    mods = { a: alpha.mod, b: beta.mod };
    rerender();
    searchBeta();

    expect(calc).toHaveBeenCalledTimes(2);
  });

  // Some extensions keep only the last listener, so one for nothing shown would take theirs.
  it("listens for changes only to the data of the columns it offers and the panel's fields", () => {
    const externalData = vi.fn();
    registered.attributes = [
      attribute({ id: "shown", externalData }),
      attribute({ id: "detail", placement: "detail", externalData }),
      attribute({ id: "otherGame", condition: () => false, externalData }),
      attribute({ id: "category", externalData }),
    ];
    const ownIds = new Set(["category"]);

    renderHook(() => useRegisteredModsColumns(ownIds, NO_MODS, true), {
      wrapper: storeWrapper(),
    });

    // The column's, and the detail field the Properties panel shows.
    expect(externalData).toHaveBeenCalledTimes(2);
  });

  describe("search", () => {
    const searchText = (attr: Partial<ITableAttribute<IModWithState>>, modRow = row()) => {
      registered.attributes = [attribute(attr)];
      return renderRegistered().columns[0].searchText?.(modRow);
    };

    it("finds a row by its value's text, as the cell shows it", () => {
      expect(searchText({ calc: () => ["Textures", "Meshes"] })).toBe("Textures, Meshes");
    });

    // Such as Endorsed, whose icon the legacy table's filter matched by its value.
    it("finds a row by its value where the extension draws the cell itself", () => {
      expect(searchText({ calc: () => "Endorsed", customRenderer: () => <span /> })).toBe(
        "Endorsed",
      );
    });

    it("finds nothing by a value that has no text, or isn't worked out yet", () => {
      expect(searchText({ calc: () => true })).toBe("");
      expect(searchText({ calc: () => Promise.resolve("Compatible") })).toBe("");
    });

    it("passes over a column with no value to search", () => {
      expect(searchText({ customRenderer: () => <span /> })).toBeUndefined();
    });
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

    // As in the legacy table, as some renderers start work as they're called, such as Content's
    // scan of the mod's files.
    it("is drawn again only when its own mod changes", () => {
      const customRenderer = vi.fn(() => <span>Content</span>);
      registered.attributes = [attribute({ customRenderer })];
      const { redraw } = renderCell();

      redraw({ b: row({ id: "b" }).mod });
      expect(customRenderer).toHaveBeenCalledTimes(1);

      redraw(NO_MODS, row({ attributes: { content: ["Textures"] } }));
      expect(customRenderer).toHaveBeenCalledTimes(2);
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

    // Outside act, as in the app, where effects run after the calc's promise has settled.
    it("shows a value worked out asynchronously that's ready before the cell's effects run", async () => {
      registered.attributes = [attribute({ calc: () => Promise.resolve("Compatible") })];
      const actEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
      globalThis.IS_REACT_ACT_ENVIRONMENT = false;
      const container = document.createElement("div");
      const root = createRoot(container);

      try {
        root.render(
          <Provider store={makeModsTableStore()}>
            <CellHarness modRow={row()} mods={withOwn(row())} />
          </Provider>,
        );

        await waitFor(() => expect(container).toHaveTextContent("Compatible"));
      } finally {
        root.unmount();
        globalThis.IS_REACT_ACT_ENVIRONMENT = actEnvironment;
      }
    });

    // As the table draws only the rows in sight, a row scrolled back in shows it at once.
    it("isn't worked out again for a row drawn again after leaving the page", async () => {
      const calc = vi.fn(() => Promise.resolve("Compatible"));
      registered.attributes = [attribute({ calc })];
      const store = makeModsTableStore();
      const modRow = row();
      const mods = withOwn(modRow);
      const { result } = renderHook(() => useRegisteredModsColumns(NO_IDS, mods, true), {
        wrapper: storeWrapper(store),
      });
      const drawCell = () =>
        render(
          <RegisteredModsInputsProvider value={result.current.inputs}>
            <div data-testid="cell">{result.current.columns[0].cell(modRow)}</div>
          </RegisteredModsInputsProvider>,
        );

      const first = drawCell();
      await waitFor(() => expect(screen.getByTestId("cell")).toHaveTextContent("Compatible"));
      first.unmount();
      drawCell();

      expect(screen.getByTestId("cell")).toHaveTextContent("Compatible");
      expect(calc).toHaveBeenCalledTimes(1);
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
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

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

      renderHook(() => useRegisteredModsColumns(NO_IDS, NO_MODS, false), {
        wrapper: storeWrapper(),
      });

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
