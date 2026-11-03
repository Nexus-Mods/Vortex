import { act, renderHook } from "@testing-library/react";
import React, { isValidElement, type ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { setActionPinned } from "@/actions/toolbars";
import type { ITableRowAction } from "@/controls/Table";
import { MODS_TABLE_TEST_GAME, makeModsTableStore } from "@/test-utils/modsTableStore";
import type { IActionDefinition } from "@/types/IActionDefinition";
import { nxmCollection } from "@/ui/icon-paths";

const { registered, uninstall, calculateModSize } = vi.hoisted(() => ({
  registered: { current: {} as { [group: string]: IActionDefinition[] } },
  uninstall: vi.fn(),
  calculateModSize: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../util/calculate_mod_size/calculateModSize.util", () => ({ calculateModSize }));

vi.mock("../use_uninstall_mods/useUninstallMods.hook", () => ({
  useUninstallMods: () => uninstall,
}));

// What extensions registered, by group.
vi.mock("@/ExtensionProvider", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useExtensionObjects: (_register: unknown, _static: unknown, group: string) =>
    registered.current[group] ?? [],
}));

import {
  MOD_ROW_PINNING_ID,
  MOD_SELECTION_PINNING_ID,
  useModRowActions,
  useModSelectionActions,
} from "./useModActions.hook";

const Dummy = () => null;

// The archives still downloaded, which an installed mod can be installed again from.
const ARCHIVES = { "archive-a": {}, "archive-b": {} };
// One installed mod with its archive, one with an archive since deleted, one without any.
const SELECTION_MODS = {
  a: { id: "a", archiveId: "archive-a" },
  c: { id: "c", archiveId: "archive-gone" },
  d: { id: "d" },
};

const renderRowActions = (
  rowActions: ITableRowAction[],
  extensions: IActionDefinition[] = [],
  mods: { [modId: string]: object } = {},
) => {
  registered.current = { "mods-action-icons": extensions };
  const store = makeModsTableStore({ mods, downloads: ARCHIVES });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  const { result } = renderHook(() => useModRowActions(rowActions), { wrapper });
  return { result, store };
};

const labels = (actions: { label: string; disabled?: boolean }[]) =>
  actions.map(({ label, disabled }) => (disabled ? `${label} (disabled)` : label));

describe("useModRowActions", () => {
  it("lays the actions out as the design's menu does, single-row ones only", () => {
    const { result } = renderRowActions(
      [
        { title: "Remove", position: 5 },
        { title: "Enable", singleRowAction: false },
        { title: "Combine", position: 70, multiRowAction: true, singleRowAction: false },
        { title: "Reinstall", position: 60 },
      ],
      [{ title: "Open on Nexus Mods", position: 30 }],
    );

    expect(labels(result.current.actionsFor("a"))).toEqual([
      "Reinstall",
      "Remove",
      "Open on Nexus Mods",
    ]);
  });

  it("names and sections each action as the design does", () => {
    const { result } = renderRowActions(
      [{ title: "Remove" }],
      [{ title: "Create Report" }, { title: "Open in File Manager" }],
    );

    expect(
      result.current.actionsFor("a").map(({ label, section }) => `${section}: ${label}`),
    ).toEqual(["manage: Remove", "open: Open in file manager", "maintenance: Generate mod report"]);
  });

  it("shows Open on Nexus Mods with the Nexus Mods logo", () => {
    const { result } = renderRowActions([], [{ title: "Open on Nexus Mods", icon: "nexus" }]);

    const [openOnNexus] = result.current.actionsFor("a");
    expect(isValidElement(openOnNexus.icon)).toBe(true);
  });

  it("puts Remove from Collection below Add to Collection, with the filled collection icon", () => {
    const { result } = renderRowActions(
      [],
      [
        { title: "Remove from Collection...", position: 300, icon: "collection" },
        { title: "Add to Collection...", position: 300, icon: "collection" },
      ],
    );

    const [add, remove] = result.current.actionsFor("a");
    expect(labels([add, remove])).toEqual(["Add to Collection", "Remove from Collection"]);
    expect(remove.icon).toEqual({ path: nxmCollection });
  });

  it("puts any action the design doesn't list last, by position", () => {
    const { result } = renderRowActions(
      [{ title: "Remove" }],
      [
        { title: "Later", position: 200 },
        { title: "Sooner", position: 10 },
      ],
    );

    expect(
      result.current.actionsFor("a").map(({ label, section }) => `${section}: ${label}`),
    ).toEqual(["manage: Remove", "other: Sooner", "other: Later"]);
  });

  it("offers Uninstall and Check for updates for an installed mod only", () => {
    const { result } = renderRowActions([{ title: "Remove" }], [], {
      a: { id: "a", archiveId: "archive-a" },
    });

    expect(labels(result.current.actionsFor("a"))).toEqual([
      "Uninstall",
      "Remove",
      "Check for updates",
    ]);
    expect(labels(result.current.actionsFor("b"))).toEqual(["Remove"]);
  });

  it("leaves Uninstall out for an installed mod without its archive, as it couldn't come back", () => {
    const { result } = renderRowActions([{ title: "Remove" }], [], {
      c: { id: "c", archiveId: "archive-gone" },
    });

    expect(labels(result.current.actionsFor("c"))).toEqual(["Remove", "Check for updates"]);
  });

  it("orders the first section as the design does", () => {
    const { result } = renderRowActions(
      [
        { title: "Check for Update" },
        { title: "Remove" },
        { title: "Remove related" },
        { title: "Reinstall" },
        { title: "Install" },
      ],
      [{ title: "Add to Collection..." }],
      { a: { id: "a", archiveId: "archive-a" } },
    );

    expect(labels(result.current.actionsFor("a"))).toEqual([
      "Add to Collection",
      "Install",
      "Reinstall",
      "Uninstall",
      "Remove related",
      "Remove",
      "Check for updates",
    ]);
  });

  it("leaves out components, classic-only actions and a repeated title", () => {
    const { result } = renderRowActions(
      [{ title: "Remove" }, { title: "Check for Update", component: Dummy }],
      [{ title: "Remove" }, { title: "Legacy", options: { isClassicOnly: true } }],
    );

    expect(labels(result.current.actionsFor("a"))).toEqual(["Remove"]);
  });

  it("leaves out an action that rules itself out, and disables one that says why", () => {
    const { result } = renderRowActions([
      { title: "Install", condition: () => false },
      { title: "Reinstall", condition: () => "No associated archive." },
    ]);

    expect(labels(result.current.actionsFor("a"))).toEqual(["Reinstall (disabled)"]);
  });

  it("keeps a pinned action that rules itself out, disabled, so every row has its button", () => {
    const { result, store } = renderRowActions([
      { title: "Install", condition: (ids) => ids[0] === "a" },
      { title: "Remove" },
    ]);

    act(() => {
      store.dispatch(
        setActionPinned({ toolbarId: MOD_ROW_PINNING_ID, actionId: "Install", pinned: true }),
      );
    });

    expect(labels(result.current.actionsFor("a"))).toEqual(["Install", "Remove"]);
    expect(labels(result.current.actionsFor("b"))).toEqual(["Install (disabled)", "Remove"]);
    expect(result.current.pinnedCount).toBe(1);
  });

  it("checks and runs an action against the mod's id", () => {
    const condition = vi.fn(() => true);
    const action = vi.fn();
    const { result } = renderRowActions([{ title: "Remove", condition, action }]);

    result.current.actionsFor("a")[0].onClick?.();

    expect(condition).toHaveBeenCalledWith(["a"]);
    expect(action).toHaveBeenCalledWith(["a"]);
  });

  it("works a mod's actions out again only once the store changes", () => {
    const condition = vi.fn(() => true);
    const { result, store } = renderRowActions([{ title: "Remove", condition }]);

    const first = result.current.actionsFor("a");
    expect(result.current.actionsFor("a")).toBe(first);

    act(() => {
      store.dispatch({ type: "UNRELATED" });
    });

    expect(result.current.actionsFor("a")).not.toBe(first);
    expect(condition).toHaveBeenCalledTimes(2);
  });

  // The Mod size column has nothing to click, so the size is worked out again from here.
  it("works out the mod's size again when Refresh content runs", () => {
    calculateModSize.mockClear();
    const refresh = vi.fn();
    const { result, store } = renderRowActions([], [{ title: "Refresh Content", action: refresh }]);

    const refreshContent = result.current
      .actionsFor("a")
      .find(({ label }) => label === "Refresh content")!;
    act(() => refreshContent.onClick?.());

    expect(refresh).toHaveBeenCalledWith(["a"]);
    expect(calculateModSize).toHaveBeenCalledWith(store, MODS_TABLE_TEST_GAME, "a");
  });

  it("leaves other actions as they were registered", () => {
    calculateModSize.mockClear();
    const { result } = renderRowActions([], [{ title: "Create Report", action: vi.fn() }]);

    act(() => result.current.actionsFor("a")[0].onClick?.());

    expect(calculateModSize).not.toHaveBeenCalled();
  });
});

describe("useModSelectionActions", () => {
  const renderSelectionActions = (
    rowActions: ITableRowAction[],
    modIds: string[],
    extensions: IActionDefinition[] = [],
  ) => {
    registered.current = { "mods-multirow-actions": extensions };
    const store = makeModsTableStore({ mods: SELECTION_MODS, downloads: ARCHIVES });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result } = renderHook(() => useModSelectionActions(rowActions, modIds), { wrapper });
    return { result, store };
  };

  it("offers the actions for several mods, but Enable and Disable, which the switch does", () => {
    const { result } = renderSelectionActions(
      [
        { title: "Enable", singleRowAction: false },
        { title: "Disable", singleRowAction: false },
        { title: "Remove related", multiRowAction: false },
        { title: "Combine", multiRowAction: true, singleRowAction: false },
        { title: "Remove" },
      ],
      ["a"],
      [{ title: "Add to Collection..." }],
    );

    expect(labels(result.current)).toEqual([
      "Check for updates",
      "Add to Collection",
      "Uninstall",
      "Remove",
      "Combine",
    ]);
  });

  it("pins Add to Collection, Reinstall, Uninstall, Check for updates and Remove until the user says otherwise", () => {
    const { result } = renderSelectionActions(
      [{ title: "Remove" }, { title: "Reinstall" }, { title: "Combine" }],
      ["a"],
      [{ title: "Add to Collection..." }, { title: "Track" }],
    );

    expect(result.current.filter(({ pinned }) => pinned).map(({ label }) => label)).toEqual([
      "Check for updates",
      "Add to Collection",
      "Reinstall",
      "Uninstall",
      "Remove",
    ]);
  });

  it("puts Combine, Track and Untrack in a section of their own, before Refresh content", () => {
    const { result } = renderSelectionActions(
      [{ title: "Combine", multiRowAction: true, singleRowAction: false }],
      ["a"],
      [
        { title: "Fix missing IDs" },
        { title: "Refresh Content" },
        { title: "Untrack" },
        { title: "Track" },
      ],
    );

    expect(
      result.current
        .filter(({ section }) => section !== "manage")
        .map(({ label, section }) => `${section}: ${label}`),
    ).toEqual([
      "organise: Combine",
      "organise: Track",
      "organise: Untrack",
      "maintenance: Refresh content",
      "maintenance: Fix missing IDs",
    ]);
  });

  it("orders the first section with Check for updates first", () => {
    const { result } = renderSelectionActions(
      [{ title: "Remove" }, { title: "Reinstall" }, { title: "Install" }],
      ["a"],
      [{ title: "Add to Collection..." }],
    );

    expect(labels(result.current)).toEqual([
      "Check for updates",
      "Add to Collection",
      "Install",
      "Reinstall",
      "Uninstall",
      "Remove",
    ]);
  });

  it("keeps a default pin that rules itself out, disabled, unless the user unpinned it", () => {
    const { result, store } = renderSelectionActions(
      [{ title: "Reinstall", condition: () => false }],
      ["b"],
    );

    expect(labels(result.current)).toEqual([
      "Check for updates (disabled)",
      "Reinstall (disabled)",
      "Uninstall (disabled)",
    ]);

    act(() => {
      store.dispatch(
        setActionPinned({
          toolbarId: MOD_SELECTION_PINNING_ID,
          actionId: "Reinstall",
          pinned: false,
        }),
      );
    });

    expect(labels(result.current)).toEqual([
      "Check for updates (disabled)",
      "Uninstall (disabled)",
    ]);
  });

  it("checks and runs an action against every selected mod", () => {
    const condition = vi.fn(() => true);
    const action = vi.fn();
    const { result } = renderSelectionActions([{ title: "Remove", condition, action }], ["a", "b"]);

    result.current.find(({ label }) => label === "Remove")?.onClick?.();

    expect(condition).toHaveBeenCalledWith(["a", "b"]);
    expect(action).toHaveBeenCalledWith(["a", "b"]);
  });

  it("uninstalls only the selected mods it could install again, leaving the rest to Remove", () => {
    const { result } = renderSelectionActions([], ["a", "c", "d"]);

    act(() => result.current.find(({ label }) => label === "Uninstall")?.onClick?.());

    expect(uninstall).toHaveBeenCalledWith(["a"]);
  });

  it("disables a pinned Uninstall when no selected mod has its archive", () => {
    const { result } = renderSelectionActions([], ["c", "d"]);

    expect(result.current.find(({ label }) => label === "Uninstall")).toMatchObject({
      disabled: true,
    });
  });

  it("works out every selected mod's size again when Refresh content runs", () => {
    calculateModSize.mockClear();
    const { result, store } = renderSelectionActions(
      [],
      ["a", "c"],
      [{ title: "Refresh Content", action: vi.fn() }],
    );

    act(() => result.current.find(({ label }) => label === "Refresh content")!.onClick?.());

    expect(calculateModSize.mock.calls).toEqual([
      [store, MODS_TABLE_TEST_GAME, "a"],
      [store, MODS_TABLE_TEST_GAME, "c"],
    ]);
  });
});
