import { renderHook } from "@testing-library/react";
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
 */
vi.mock("@/ExtensionProvider", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useExtensionObjects: () => objects.current,
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

const labels = (definitions: IActionDefinition[]): string[] => {
  objects.current = definitions;
  const { result } = renderHook(() => useModToolbarActions(t));

  return result.current.map((action) => action.label);
};

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
