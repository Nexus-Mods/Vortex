import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import React from "react";
import type * as ReactReduxTypes from "react-redux";
import { describe, expect, it, vi } from "vitest";

import type { IActionDefinition } from "@/types/IActionDefinition";

const { getState, objects } = vi.hoisted(() => ({
  getState: vi.fn(() => ({})),
  objects: { current: [] as IActionDefinition[] },
}));

vi.mock("@/contexts", () => ({
  useMainContext: () => ({
    api: {
      events: { emit: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
      getState,
      showErrorNotification: vi.fn(),
      sendNotification: vi.fn(),
    },
  }),
}));

/**
 * The registrations under test. `useRegisteredActions` reads the group through this;
 * the rest of the module has to stay, `ActionControl` taking `extend` from it.
 *
 * Group-aware, because the real thing is: an extension registers into `mod-icons`, and
 * anything that reaches the "Open ..." or "Import ..." menus does so by its icon rather
 * than by registering into their groups. Answering every group with the same list puts
 * each action in a menu *and* on the bar.
 */
vi.mock("@/ExtensionProvider", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useExtensionObjects: (_registerFunc: unknown, _static: unknown, group: string) =>
    group === "mod-icons" ? objects.current : [],
}));

const state = {
  settings: {
    mods: { activator: {}, confirmPurge: true },
    downloads: { copyOnIFF: false },
    automation: { install: false },
  },
  session: { discovery: {} },
  persistent: { mods: {} },
};

vi.mock("react-redux", async () => {
  const actual = await vi.importActual<typeof ReactReduxTypes>("react-redux");

  return {
    ...actual,
    useDispatch: () => vi.fn(),
    useSelector: (selector: (input: unknown) => unknown) => {
      try {
        return selector(state);
      } catch {
        // the hook's own actions read slices this fixture doesn't carry; they are not
        // what these tests are about
        return undefined;
      }
    },
  };
});

import { useModToolbarActions } from "./useModToolbarActions.hook";

const t = ((key: string) => key) as never;

const actionsFor = (definitions: IActionDefinition[], onActionClick?: () => void) => {
  objects.current = definitions;
  const { result } = renderHook(() => useModToolbarActions(t, onActionClick));

  return result.current;
};

const labels = (definitions: IActionDefinition[]): string[] =>
  actionsFor(definitions).map((action) => action.label);

const byLabel = (definitions: IActionDefinition[], label: string, onActionClick?: () => void) =>
  actionsFor(definitions, onActionClick).find((action) => action.label === label);

/** Two registrations sharing the "open-ext" icon, which is what folds them into a menu. */
const opener = (title: string, namespace: string): IActionDefinition => ({
  icon: "open-ext",
  title,
  position: 90,
  options: { namespace },
  action: () => undefined,
});

const plain = (title: string, options: IActionDefinition["options"] = {}): IActionDefinition => ({
  icon: "rules",
  title,
  position: 90,
  options,
  action: () => undefined,
});

// --- Tests ---

describe("useModToolbarActions", () => {
  it("shows an action registered without a preference either way", () => {
    expect(labels([plain("Manage Rules")])).toContain("Manage Rules");
  });

  // Registered for the classic toolbar to render, which still exists — see ModList.
  it("leaves a classic-only action to the classic toolbar", () => {
    expect(labels([plain("Manage Rules", { isClassicOnly: true })])).not.toContain("Manage Rules");
  });

  it("keeps an action marked for this toolbar", () => {
    expect(labels([plain("Manage Rules", { isModernOnly: true })])).toContain("Manage Rules");
  });

  // A component can't be measured, promoted, collapsed or pinned, so only the classic
  // bar can draw one.
  it("leaves a component registration to the classic toolbar", () => {
    const asComponent: IActionDefinition = {
      component: () => null,
      props: () => ({}),
      position: 105,
      options: {},
    } as unknown as IActionDefinition;

    expect(labels([asComponent])).toHaveLength(4);
  });
});

describe("useModToolbarActions tracking identity", () => {
  it("identifies a registered action by its bare title and its extension", () => {
    const action = byLabel(
      [plain("Manage Rules", { namespace: "mod-dependency-manager" })],
      "Manage Rules",
    );

    expect(action?.id).toBe("Manage Rules");
    expect(action?.extension).toBe("mod-dependency-manager");
  });

  // A notice follows state, so folding it into the label the way the bar does would
  // split one button across as many ids as it has things to say.
  it("keeps the notice out of the identity, though the label shows it", () => {
    const withNotice = plain("Manage Rules", {
      namespace: "mod-dependency-manager",
      notice: () => "2 unresolved",
    });
    const action = byLabel([withNotice], "Manage Rules (2 unresolved)");

    expect(action?.id).toBe("Manage Rules");
  });

  // "Open..." is built from a translated word, so the menu's own stable id is what
  // both a pin and a click are recorded against.
  it("identifies the Open menu by its own id", () => {
    const menu = byLabel(
      [opener("Open Mod Folder", "open-directory"), opener("Open Game Folder", "open-directory")],
      "Open...",
    );

    expect(menu?.id).toBe("open");
  });

  it("counts a row inside that menu against the menu, not the bar", () => {
    const onActionClick = vi.fn();
    const menu = byLabel(
      [opener("Open Mod Folder", "open-directory"), opener("Open Game Folder", "open-directory")],
      "Open...",
      onActionClick,
    );

    const { getByRole } = render(
      <>{menu?.panel?.({ close: () => undefined, dismiss: () => undefined })}</>,
    );
    fireEvent.click(getByRole("menuitem", { name: "Open Mod Folder" }));

    expect(onActionClick).toHaveBeenCalledWith(
      { id: "Open Mod Folder", extension: "open-directory" },
      "menu",
    );
  });

  // Collapsed to a single entry it goes on the bar, where the group counts it like any
  // other action — counting it here as well would report every use twice.
  it("leaves a one-entry menu to the bar", () => {
    const onActionClick = vi.fn();
    const only = byLabel(
      [opener("Open Mod Folder", "open-directory")],
      "Open Mod Folder",
      onActionClick,
    );

    only?.onClick?.();

    expect(onActionClick).not.toHaveBeenCalled();
    expect(only?.id).toBe("Open Mod Folder");
    expect(only?.extension).toBe("open-directory");
  });
});
