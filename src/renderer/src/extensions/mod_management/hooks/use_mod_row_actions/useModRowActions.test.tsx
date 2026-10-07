import { act, renderHook } from "@testing-library/react";
import React, { isValidElement, type ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { setActionPinned } from "@/actions/toolbars";
import type { ITableRowAction } from "@/controls/Table";
import { makeModsTableStore } from "@/test-utils/modsTableStore";
import type { IActionDefinition } from "@/types/IActionDefinition";

const { registered } = vi.hoisted(() => ({ registered: { current: [] as IActionDefinition[] } }));

// What extensions registered for rows; any other group gets nothing.
vi.mock("@/ExtensionProvider", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useExtensionObjects: (_register: unknown, _static: unknown, group: string) =>
    group === "mods-action-icons" ? registered.current : [],
}));

import { MOD_ROW_PINNING_ID, useModRowActions } from "./useModRowActions.hook";

const Dummy = () => null;

const renderRowActions = (
  rowActions: ITableRowAction[],
  extensions: IActionDefinition[] = [],
  mods: { [modId: string]: object } = {},
) => {
  registered.current = extensions;
  const store = makeModsTableStore({ mods });
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

  it("offers Check for updates for an installed mod only", () => {
    const { result } = renderRowActions([{ title: "Remove" }], [], { a: { id: "a" } });

    expect(labels(result.current.actionsFor("a"))).toEqual(["Check for updates", "Remove"]);
    expect(labels(result.current.actionsFor("b"))).toEqual(["Remove"]);
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
});
