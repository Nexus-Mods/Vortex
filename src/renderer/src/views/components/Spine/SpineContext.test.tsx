import { act, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ISettingsInterface } from "@/types/IState";

/** A fake store: the spine reads these through the mocked selectors below. */
const store = vi.hoisted(() => ({
  state: {} as {
    mainPage: string;
    activeGameId: string | undefined;
    activeProfileId: string | undefined;
    lastActiveProfiles: Record<string, string>;
    settings: { interface: ISettingsInterface };
    session: { base: object };
  },
  dispatch: vi.fn(),
  emit: vi.fn(),
}));

vi.mock("react-redux", () => ({
  useDispatch: () => store.dispatch,
  useSelector: (selector: (state: unknown) => unknown) => selector(store.state),
}));

vi.mock("../../../util/selectors", () => ({
  activeGameId: (s: typeof store.state) => s.activeGameId,
  activeProfileId: (s: typeof store.state) => s.activeProfileId,
  lastActiveProfiles: (s: typeof store.state) => s.lastActiveProfiles,
  mainPage: (s: typeof store.state) => s.mainPage,
  profileById: (_s: unknown, id: string) => ({ id }),
}));

const pages = vi.hoisted(() =>
  [
    ["Dashboard", "dashboard"],
    ["Games", "global"],
    ["application_settings", "global"],
    ["Mods", "per-game"],
    ["health", "per-game"],
    ["Downloads", "global"],
    ["collection-view", "hidden"],
  ].map(([id, group]) => ({ id, group, visible: () => true })),
);

vi.mock("../../../contexts", () => ({
  useMainContext: () => ({
    api: {
      events: { emit: store.emit, on: vi.fn(), once: vi.fn(), removeListener: vi.fn() },
      getState: () => store.state,
    },
  }),
  usePagesContext: () => ({ mainPages: pages }),
}));

import { VortexGameId } from "@vortex/shared";

import { setOpenMainPage } from "../../../actions/session";
import { setNextProfile } from "../../../extensions/profile_management/actions/settings";
import { setLastPage } from "../../../extensions/settings_interface/actions/interface";
import interfaceReducer from "../../../extensions/settings_interface/reducers/interface";
import { defaultState as sessionDefaultState } from "../../../reducers/session";
import { SpineProvider, useSpineContext } from "./SpineContext";

let spine: ReturnType<typeof useSpineContext>;

/** The pages the spine opened, ignoring the remembered-page bookkeeping it also dispatches. */
const navigations = () =>
  store.dispatch.mock.calls
    .map(([action]: [{ type: string }]) => action)
    .filter((action) => action.type === setOpenMainPage.getType());

const Probe = () => {
  spine = useSpineContext();
  const { selection } = spine;
  return (
    <div data-testid="selection">
      {selection.type === "game" ? selection.gameId : selection.type}
    </div>
  );
};

const tree = () => (
  <SpineProvider>
    <Probe />
  </SpineProvider>
);

/** Mounts the spine, by default on a game page, with helpers to move the fake store. */
const renderSpine = () => {
  const { rerender } = render(tree());
  const update = () => rerender(tree());
  const navigate = (page: string) => {
    store.state.mainPage = page;
    update();
  };
  const activate = (gameId: string) => {
    store.state.activeGameId = gameId;
    store.state.activeProfileId = `${gameId}-profile`;
    update();
  };
  return { navigate, activate };
};

describe("SpineProvider", () => {
  beforeEach(() => {
    store.state = {
      mainPage: "Mods",
      activeGameId: "skyrim",
      activeProfileId: "skyrim-profile",
      lastActiveProfiles: { skyrim: "skyrim-profile", stardew: "stardew-profile" },
      settings: { interface: {} as ISettingsInterface },
      session: { base: {} },
    };
    // Applies the remembered page as the real reducer would, the way persisted state would hold it.
    store.dispatch = vi.fn((action: { type: string; payload: never }) => {
      if (action.type === setLastPage.getType()) {
        store.state.settings.interface = interfaceReducer.reducers[action.type](
          store.state.settings.interface,
          action.payload,
        );
      }
    });
    store.emit = vi.fn();
  });

  it("starts in the active game whatever is open, then opens one of its pages", () => {
    // As when switching from the classic layout, where the Games page was open.
    store.state.mainPage = "application_settings";
    renderSpine();

    expect(screen.getByTestId("selection")).toHaveTextContent("skyrim");
    expect(store.dispatch).toHaveBeenCalledWith(setOpenMainPage("Mods", false));
  });

  it("starts on the Games page when no game is active", () => {
    store.state.mainPage = sessionDefaultState.mainPage;
    store.state.activeGameId = undefined;
    store.state.activeProfileId = undefined;
    renderSpine();

    expect(sessionDefaultState.mainPage).toBe("Games");
    expect(screen.getByTestId("selection")).toHaveTextContent("home");
    expect(navigations()).toEqual([]);
  });

  it("selects Home when a global page is opened by any route, game or not", () => {
    const { navigate } = renderSpine();

    navigate("application_settings");

    expect(screen.getByTestId("selection")).toHaveTextContent("home");
    expect(navigations()).toEqual([]);
  });

  it("keeps the selection for a hidden page, and doesn't navigate away from it", () => {
    const { navigate } = renderSpine();
    navigate("application_settings");

    navigate("collection-view");

    expect(screen.getByTestId("selection")).toHaveTextContent("home");
    expect(navigations()).toEqual([]);
  });

  it("leaves Downloads when Home is picked", () => {
    const { navigate } = renderSpine();
    navigate("Downloads");

    act(() => spine.selectHome());

    expect(store.dispatch).toHaveBeenCalledWith(setOpenMainPage("Dashboard", false));
  });

  it("opens a picked game's page once that game becomes active", () => {
    const { navigate, activate } = renderSpine();
    navigate("Dashboard");

    act(() => spine.selectGame(VortexGameId("stardew")));
    // Switches the profile, but stays Home until that lands.
    expect(store.dispatch).toHaveBeenCalledWith(setNextProfile("stardew-profile"));
    expect(store.dispatch).not.toHaveBeenCalledWith(setOpenMainPage("Mods", false));

    activate("stardew");

    expect(store.dispatch).toHaveBeenCalledWith(setOpenMainPage("Mods", false));
  });

  it("returns a picked game to its own last page, not the one open now", () => {
    store.state.activeGameId = "stardew";
    store.state.activeProfileId = "stardew-profile";
    store.state.mainPage = "health";
    const { navigate, activate } = renderSpine();

    activate("skyrim");
    navigate("Mods");

    act(() => spine.selectGame(VortexGameId("stardew")));
    activate("stardew");

    expect(navigations().at(-1)).toEqual(setOpenMainPage("health", false));
  });

  it("remembers the page open in a game and on Home", () => {
    const { navigate } = renderSpine();

    navigate("health");
    navigate("application_settings");

    expect(store.dispatch).toHaveBeenCalledWith(
      setLastPage({ pageId: "health", gameId: VortexGameId("skyrim") }),
    );
    expect(store.dispatch).toHaveBeenCalledWith(setLastPage({ pageId: "application_settings" }));
  });

  it("reopens the active game's remembered page after a restart", () => {
    store.state.mainPage = sessionDefaultState.mainPage;
    store.state.settings.interface.lastPage = { games: { [VortexGameId("skyrim")]: "health" } };
    renderSpine();

    expect(navigations()).toEqual([setOpenMainPage("health", false)]);
  });

  it("opens the game's first page when its remembered page can no longer be shown", () => {
    store.state.mainPage = sessionDefaultState.mainPage;
    store.state.settings.interface.lastPage = { games: { [VortexGameId("skyrim")]: "removed" } };
    renderSpine();

    expect(navigations()).toEqual([setOpenMainPage("Mods", false)]);
  });

  it("returns a picked game to its remembered page from an earlier session", () => {
    store.state.settings.interface.lastPage = { games: { [VortexGameId("stardew")]: "health" } };
    const { activate } = renderSpine();

    act(() => spine.selectGame(VortexGameId("stardew")));
    activate("stardew");

    expect(navigations().at(-1)).toEqual(setOpenMainPage("health", false));
  });
});
