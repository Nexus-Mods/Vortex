import { render } from "@testing-library/react";
import React from "react";
import type * as ReactReduxTypes from "react-redux";
import { describe, expect, it, vi } from "vitest";

import type { IMainPage } from "../types/IMainPage";

const registered = vi.hoisted(() => ({ current: [] as IMainPage[] }));
const store = vi.hoisted(() => ({ useModernLayout: true }));

vi.mock("../hooks/useMainPages", () => ({ useMainPages: () => registered.current }));

/** Only the registered page is under test, so the built-ins stay out of the way. */
vi.mock("./builtInPages", () => ({ builtInPages: [] }));

vi.mock("react-redux", async () => {
  const actual = await vi.importActual<typeof ReactReduxTypes>("react-redux");

  return {
    ...actual,
    useDispatch: () => vi.fn(),
    useSelector: (selector: (state: unknown) => unknown) =>
      selector({
        settings: {
          window: { useModernLayout: store.useModernLayout },
          profiles: { activeProfileId: "profile-1" },
          interface: { profilesVisible: false },
          gameMode: { discovered: {} },
        },
        session: { base: { mainPage: "Mods" } },
        persistent: { profiles: { "profile-1": { gameId: "stardewvalley" } } },
      }),
  };
});

import { PagesProvider, usePagesContext } from "./PagesContext";

// --- Helpers ---

const page = (newLayout: IMainPage["newLayout"]): IMainPage =>
  ({
    id: "Mods",
    icon: "mods",
    title: "Mods",
    group: "per-game",
    component: () => null,
    propsFunc: () => ({}),
    visible: () => true,
    newLayout,
  }) as IMainPage;

/** What MainPageContainer would receive for the one registered page. */
const resolvedNewLayout = (newLayout: IMainPage["newLayout"], useModernLayout: boolean) => {
  registered.current = [page(newLayout)];
  store.useModernLayout = useModernLayout;

  let seen: IMainPage["newLayout"];
  const Probe = () => {
    seen = usePagesContext().mainPages[0]?.newLayout;
    return null;
  };

  render(
    <PagesProvider>
      <Probe />
    </PagesProvider>,
  );

  return seen;
};

// --- Tests ---

describe("PagesProvider", () => {
  it("passes a hardcoded newLayout through untouched", () => {
    expect(resolvedNewLayout(true, true)).toBe(true);
    expect(resolvedNewLayout(true, false)).toBe(true);
  });

  it("leaves a page with no newLayout alone", () => {
    expect(resolvedNewLayout(undefined, false)).toBeUndefined();
  });

  // The form the mods page uses, so it can draw its old rendering under the classic UI.
  it("resolves a callback against the layout the user chose", () => {
    const fromSetting = () => store.useModernLayout;

    expect(resolvedNewLayout(fromSetting, true)).toBe(true);
    expect(resolvedNewLayout(fromSetting, false)).toBe(false);
  });
});
