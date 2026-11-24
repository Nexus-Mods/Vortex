import { act, renderHook } from "@testing-library/react";
import React, { isValidElement, type ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { setActionPinned } from "@/actions/toolbars";
import type { ITableRowAction } from "@/controls/Table";
import { MODS_TABLE_TEST_GAME, makeModsTableStore } from "@/test-utils/modsTableStore";
import type { IActionDefinition } from "@/types/IActionDefinition";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { nxmCollection, nxmHighlight } from "@/ui/icon-paths";

const { registered, uninstall, remove, calculateModSize } = vi.hoisted(() => ({
  registered: { current: {} as { [group: string]: IActionDefinition[] } },
  uninstall: vi.fn(),
  remove: vi.fn(),
  calculateModSize: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../util/calculate_mod_size/calculateModSize.util", () => ({ calculateModSize }));

vi.mock("../use_uninstall_mods/useUninstallMods.hook", () => ({
  useUninstallMods: () => uninstall,
}));

vi.mock("../use_remove_mods/useRemoveMods.hook", () => ({
  useRemoveMods: () => remove,
}));

// The key with its namespace, where a call names one, so a test can see which it read from.
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTranslation: () => {
    const t = (key: string, options?: { ns?: string }) =>
      options?.ns === undefined ? key : `${options.ns}:${key}`;
    return Object.assign([t, undefined, true], { t, i18n: undefined, ready: true });
  },
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
  activity: { [group: string]: string[] } = {},
) => {
  registered.current = { "mods-action-icons": extensions };
  const store = makeModsTableStore({ mods, downloads: ARCHIVES, activity });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  const { result } = renderHook(() => useModRowActions(rowActions), { wrapper });
  return { result, store };
};

// By id, the title an action was registered with, as its label is a translation.
const ids = (actions: IToolbarAction[]) =>
  actions.map(({ id, disabled }) => (disabled ? `${id} (disabled)` : id));

describe("useModRowActions", () => {
  it("lays the actions out as the design's menu does, single-row ones only", () => {
    const { result } = renderRowActions(
      [
        { title: "Install", position: 5 },
        { title: "Enable", singleRowAction: false },
        { title: "Combine", position: 70, multiRowAction: true, singleRowAction: false },
        { title: "Reinstall", position: 60 },
      ],
      [{ title: "Open on Nexus Mods", position: 30 }],
    );

    expect(ids(result.current.actionsFor("a"))).toEqual([
      "Install",
      "Reinstall",
      "Open on Nexus Mods",
    ]);
  });

  it("names and sections each action as the design does", () => {
    const { result } = renderRowActions(
      [{ title: "Reinstall" }],
      [{ title: "Create Report" }, { title: "Open in File Manager" }],
    );

    expect(
      result.current.actionsFor("a").map(({ label, section }) => `${section}: ${label}`),
    ).toEqual([
      "manage: modsTable::actions::reinstall",
      "open: modsTable::actions::openInFileManager",
      "maintenance: modsTable::actions::generateModReport",
    ]);
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
    expect([add.label, remove.label]).toEqual([
      "modsTable::actions::addToCollection",
      "modsTable::actions::removeFromCollection",
    ]);
    expect(remove.icon).toEqual({ path: nxmCollection });
  });

  it("puts any action the design doesn't list last, by position", () => {
    const { result } = renderRowActions(
      [{ title: "Reinstall" }],
      [
        { title: "Later", position: 200 },
        { title: "Sooner", position: 10 },
      ],
    );

    expect(result.current.actionsFor("a").map(({ id, section }) => `${section}: ${id}`)).toEqual([
      "manage: Reinstall",
      "other: Sooner",
      "other: Later",
    ]);
  });

  it("names an action the design doesn't list from its extension's namespace, or common", () => {
    const { result } = renderRowActions(
      [],
      [{ title: "Own Words", options: { namespace: "my-ext" } }, { title: "Shared Words" }],
    );

    expect(result.current.actionsFor("a").map(({ label }) => label)).toEqual([
      "my-ext:Own Words",
      "common:Shared Words",
    ]);
  });

  it("offers Uninstall and Check for updates for an installed mod only", () => {
    const { result } = renderRowActions([{ title: "Remove" }], [], {
      a: { id: "a", archiveId: "archive-a" },
    });

    expect(ids(result.current.actionsFor("a"))).toEqual([
      "Uninstall",
      "Remove",
      "Check for Update",
    ]);
    // Neither installed nor downloaded, so there's nothing to remove either.
    expect(ids(result.current.actionsFor("b"))).toEqual([]);
  });

  it("leaves Uninstall out for an installed mod without its archive, as it couldn't come back", () => {
    const { result } = renderRowActions([{ title: "Remove" }], [], {
      c: { id: "c", archiveId: "archive-gone" },
    });

    expect(ids(result.current.actionsFor("c"))).toEqual(["Remove", "Check for Update"]);
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

    expect(ids(result.current.actionsFor("a"))).toEqual([
      "Add to Collection...",
      "Install",
      "Reinstall",
      "Uninstall",
      "Remove related",
      "Remove",
      "Check for Update",
    ]);
  });

  it("leaves out components, classic-only actions and a repeated title", () => {
    const { result } = renderRowActions(
      [{ title: "Reinstall" }, { title: "Check for Update", component: Dummy }],
      [{ title: "Reinstall" }, { title: "Legacy", options: { isClassicOnly: true } }],
    );

    expect(ids(result.current.actionsFor("a"))).toEqual(["Reinstall"]);
  });

  it("leaves out an action that rules itself out, and disables one that says why", () => {
    const { result } = renderRowActions([
      { title: "Install", condition: () => false },
      { title: "Reinstall", condition: () => "No associated archive." },
    ]);

    expect(ids(result.current.actionsFor("a"))).toEqual(["Reinstall (disabled)"]);
  });

  it("keeps a pinned action that rules itself out, disabled, so every row has its button", () => {
    const { result, store } = renderRowActions([
      { title: "Install", condition: (ids) => ids[0] === "a" },
      { title: "Reinstall" },
    ]);

    act(() => {
      store.dispatch(
        setActionPinned({ toolbarId: MOD_ROW_PINNING_ID, actionId: "Install", pinned: true }),
      );
    });

    expect(ids(result.current.actionsFor("a"))).toEqual(["Install", "Reinstall"]);
    expect(ids(result.current.actionsFor("b"))).toEqual(["Install (disabled)", "Reinstall"]);
    expect(result.current.pinnedCount).toBe(1);
  });

  it("checks and runs an action against the mod's id", () => {
    const condition = vi.fn(() => true);
    const action = vi.fn();
    const { result } = renderRowActions([{ title: "Reinstall", condition, action }]);

    result.current.actionsFor("a")[0].onClick?.();

    expect(condition).toHaveBeenCalledWith(["a"]);
    expect(action).toHaveBeenCalledWith(["a"]);
  });

  it("works a mod's actions out again only once the store changes", () => {
    const condition = vi.fn(() => true);
    const { result, store } = renderRowActions([{ title: "Reinstall", condition }]);

    const first = result.current.actionsFor("a");
    expect(result.current.actionsFor("a")).toBe(first);

    act(() => {
      store.dispatch({ type: "UNRELATED" });
    });

    expect(result.current.actionsFor("a")).not.toBe(first);
    expect(condition).toHaveBeenCalledTimes(2);
  });

  it("removes through the table's own Remove, not the classic one", () => {
    const classic = vi.fn();
    const { result } = renderRowActions([{ title: "Remove", position: 5, action: classic }], [], {
      a: { id: "a" },
    });

    act(() =>
      result.current
        .actionsFor("a")
        .find(({ id }) => id === "Remove")
        ?.onClick?.(),
    );

    expect(remove).toHaveBeenCalledWith(["a"]);
    expect(classic).not.toHaveBeenCalled();
  });

  it("offers neither Remove nor Uninstall on a row that's being removed or uninstalled", () => {
    const mods = { a: { id: "a", archiveId: "archive-a" }, b: { id: "b", archiveId: "archive-b" } };
    const { result } = renderRowActions([], [], mods, {
      "mods-removing": ["a"],
      "mods-uninstalling": ["b"],
    });

    expect(ids(result.current.actionsFor("a"))).toEqual(["Check for Update"]);
    expect(ids(result.current.actionsFor("b"))).toEqual(["Check for Update"]);
  });

  it("offers Remove related only on a row that isn't being removed or uninstalled", () => {
    const mods = {
      a: { id: "a", archiveId: "archive-a" },
      b: { id: "b", archiveId: "archive-b" },
      c: { id: "c" },
    };
    const condition = vi.fn(() => true);
    const { result } = renderRowActions([{ title: "Remove related", condition }], [], mods, {
      "mods-removing": ["a"],
      "mods-uninstalling": ["b"],
    });

    expect(ids(result.current.actionsFor("a"))).not.toContain("Remove related");
    expect(ids(result.current.actionsFor("b"))).not.toContain("Remove related");
    expect(ids(result.current.actionsFor("c"))).toContain("Remove related");
    expect(condition).toHaveBeenCalledTimes(1);
    expect(condition).toHaveBeenCalledWith(["c"]);
  });

  // Each would install from an archive a removal may be deleting, or into a mod it's taking away.
  it("offers Install, Unpack and Reinstall only on a row that isn't being removed or uninstalled", () => {
    const mods = {
      a: { id: "a", archiveId: "archive-a" },
      b: { id: "b", archiveId: "archive-b" },
      c: { id: "c" },
    };
    const installs = [{ title: "Install" }, { title: "Unpack (as-is)" }, { title: "Reinstall" }];
    const { result } = renderRowActions(installs, [], mods, {
      "mods-removing": ["a"],
      "mods-uninstalling": ["b"],
    });

    for (const { title } of installs) {
      expect(ids(result.current.actionsFor("a"))).not.toContain(title);
      expect(ids(result.current.actionsFor("b"))).not.toContain(title);
      expect(ids(result.current.actionsFor("c"))).toContain(title);
    }
  });

  // The Mod size column has nothing to click, so the size is worked out again from here.
  it("works out the mod's size again when Refresh content runs", () => {
    calculateModSize.mockClear();
    const refresh = vi.fn();
    const { result, store } = renderRowActions([], [{ title: "Refresh Content", action: refresh }]);

    const refreshContent = result.current
      .actionsFor("a")
      .find(({ id }) => id === "Refresh Content")!;
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
    activity: { [group: string]: string[] } = {},
  ) => {
    registered.current = { "mods-multirow-actions": extensions };
    const store = makeModsTableStore({ mods: SELECTION_MODS, downloads: ARCHIVES, activity });
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

    expect(ids(result.current)).toEqual([
      "Check for Update",
      "Add to Collection...",
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

    expect(result.current.filter(({ pinned }) => pinned).map(({ id }) => id)).toEqual([
      "Check for Update",
      "Add to Collection...",
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
        .map(({ id, section }) => `${section}: ${id}`),
    ).toEqual([
      "organise: Combine",
      "organise: Track",
      "organise: Untrack",
      "maintenance: Refresh Content",
      "maintenance: Fix missing IDs",
    ]);
  });

  it("orders the first section with Check for updates first", () => {
    const { result } = renderSelectionActions(
      [{ title: "Remove" }, { title: "Reinstall" }, { title: "Install" }],
      ["a"],
      [{ title: "Add to Collection..." }],
    );

    expect(ids(result.current)).toEqual([
      "Check for Update",
      "Add to Collection...",
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

    expect(ids(result.current)).toEqual([
      "Check for Update (disabled)",
      "Reinstall (disabled)",
      "Uninstall (disabled)",
      "Remove (disabled)",
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

    expect(ids(result.current)).toEqual([
      "Check for Update (disabled)",
      "Uninstall (disabled)",
      "Remove (disabled)",
    ]);
  });

  it("checks and runs an action against every selected mod", () => {
    const condition = vi.fn(() => true);
    const action = vi.fn();
    const { result } = renderSelectionActions(
      [{ title: "Reinstall", condition, action }],
      ["a", "b"],
    );

    result.current.find(({ id }) => id === "Reinstall")?.onClick?.();

    expect(condition).toHaveBeenCalledWith(["a", "b"]);
    expect(action).toHaveBeenCalledWith(["a", "b"]);
  });

  it("opens an action's panel for every selected mod, in place of running it", () => {
    const panel = vi.fn(() => <Dummy />);
    const { result } = renderSelectionActions(
      [],
      ["a", "b"],
      [{ title: "Highlight Mods", options: { panel } }],
    );

    const highlight = result.current.find(({ id }) => id === "Highlight Mods");
    const controls = { close: vi.fn(), dismiss: vi.fn() };
    highlight?.panel?.(controls);

    expect(highlight?.onClick).toBeUndefined();
    expect(panel).toHaveBeenCalledWith(["a", "b"], controls);
  });

  it("offers Highlight mods unpinned, with the classic table's highlight icon", () => {
    const { result } = renderSelectionActions(
      [{ title: "Combine", multiRowAction: true, singleRowAction: false }],
      ["a"],
      [{ title: "Highlight Mods", icon: "highlight", options: { panel: () => null } }],
    );

    const highlight = result.current.find(({ id }) => id === "Highlight Mods");
    expect(highlight).toMatchObject({
      label: "modsTable::actions::highlightMods",
      icon: { path: nxmHighlight },
      section: "organise",
      pinned: false,
    });
    expect(
      result.current.filter(({ section }) => section === "organise").map(({ id }) => id),
    ).toEqual(["Combine", "Highlight Mods"]);
  });

  it("uninstalls only the selected mods it could install again, leaving the rest to Remove", () => {
    const { result } = renderSelectionActions([], ["a", "c", "d"]);

    act(() => result.current.find(({ id }) => id === "Uninstall")?.onClick?.());

    expect(uninstall).toHaveBeenCalledWith(["a"]);
  });

  it("disables a pinned Uninstall when no selected mod has its archive", () => {
    const { result } = renderSelectionActions([], ["c", "d"]);

    expect(result.current.find(({ id }) => id === "Uninstall")).toMatchObject({
      disabled: true,
    });
  });

  it("disables the pinned Remove and Uninstall while every selected mod is being removed", () => {
    const { result } = renderSelectionActions([], ["a"], [], { "mods-removing": ["a"] });

    expect(ids(result.current)).toEqual([
      "Check for Update",
      "Uninstall (disabled)",
      "Remove (disabled)",
    ]);
  });

  it("removes the selected mods while any of them can be, leaving the busy ones to the removal", () => {
    const { result } = renderSelectionActions([], ["a", "c"], [], { "mods-removing": ["a"] });

    const removeAction = result.current.find(({ id }) => id === "Remove");
    expect(removeAction?.disabled).toBe(false);
    act(() => removeAction?.onClick?.());

    expect(remove).toHaveBeenCalledWith(["a", "c"]);
  });

  it("works out every selected mod's size again when Refresh content runs", () => {
    calculateModSize.mockClear();
    const { result, store } = renderSelectionActions(
      [],
      ["a", "c"],
      [{ title: "Refresh Content", action: vi.fn() }],
    );

    act(() => result.current.find(({ id }) => id === "Refresh Content")!.onClick?.());

    expect(calculateModSize.mock.calls).toEqual([
      [store, MODS_TABLE_TEST_GAME, "a"],
      [store, MODS_TABLE_TEST_GAME, "c"],
    ]);
  });
});
