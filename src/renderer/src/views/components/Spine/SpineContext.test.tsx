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
    nextProfileId?: string;
    lastActiveProfiles: Record<string, string>;
    settings: { interface: ISettingsInterface };
    session: { base: object };
  },
  dispatch: vi.fn(),
  emit: vi.fn(),
  on: vi.fn<(event: string, listener: (...args: unknown[]) => void) => void>(),
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
  nextProfileId: (s: typeof store.state) => s.nextProfileId,
  // Profiles here are named after their game: "stardew-profile".
  profileById: (_s: unknown, id: string) => ({ id, gameId: id.replace(/-profile$/, "") }),
}));

const pages = vi.hoisted(() =>
  [
    ["Dashboard", "dashboard"],
    ["Games", "global"],
    ["application_settings", "global"],
    ["Mods", "per-game"],
    ["Browse", "per-game"],
    ["health", "per-game"],
    ["Downloads", "global"],
    ["collection-view", "hidden"],
  ].map(([id, group]) => ({ id, group, visible: () => true })),
);

vi.mock("../../../contexts", () => ({
  useMainContext: () => ({
    api: {
      events: { emit: store.emit, on: store.on, once: vi.fn(), removeListener: vi.fn() },
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

/** Pages the spine opened, without its setLastPage dispatches. */
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
  return { navigate, activate, update };
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
    // Apply setLastPage through the real reducer.
    store.dispatch = vi.fn((action: { type: string; payload: never }) => {
      if (action.type === setLastPage.getType()) {
        store.state.settings.interface = interfaceReducer.reducers[action.type](
          store.state.settings.interface,
          action.payload,
        );
      }
    });
    store.emit = vi.fn();
    store.on = vi.fn();
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

  // What the Games page's Open asks for. It has to be the spine's own pick, so the two
  // can't come to open a game differently.
  it("opens a game asked for by event the way a pick in the spine does", () => {
    store.state.settings.interface.lastPages = { games: { [VortexGameId("stardew")]: "health" } };
    const { navigate, activate } = renderSpine();
    navigate("Games");

    // The listener of the latest render, as an emit would reach it.
    const openGame = store.on.mock.calls.findLast(([event]) => event === "open-game")?.[1];
    act(() => openGame?.(VortexGameId("stardew")));

    expect(store.dispatch).toHaveBeenCalledWith(setNextProfile("stardew-profile"));
    expect(navigations()).toEqual([]);

    activate("stardew");

    expect(navigations()).toEqual([setOpenMainPage("health", false)]);
  });

  // Adding a game starts the switch to its new profile, then asks for the game. The
  // profile was never active, so going on to activate it would raise the profile picker.
  it("opens a game that was just added on the page asked for, and doesn't ask for a profile", () => {
    // Left behind by managing the game before.
    store.state.settings.interface.lastPages = { games: { [VortexGameId("terraria")]: "health" } };
    const { navigate, activate } = renderSpine();
    navigate("Games");
    store.state.nextProfileId = "terraria-profile";

    const openGame = store.on.mock.calls.findLast(([event]) => event === "open-game")?.[1];
    act(() => openGame?.(VortexGameId("terraria"), { page: "Browse" }));

    expect(store.emit).not.toHaveBeenCalledWith("activate-game", expect.anything());
    expect(store.dispatch).not.toHaveBeenCalledWith(setNextProfile(expect.anything()));

    activate("terraria");

    expect(navigations()).toEqual([setOpenMainPage("Browse", false)]);

    navigate("Browse");

    // Remembered in place of the page left behind, so the next pick in the spine agrees.
    expect(store.state.settings.interface.lastPages?.games?.[VortexGameId("terraria")]).toBe(
      "Browse",
    );
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
    store.state.settings.interface.lastPages = { games: { [VortexGameId("skyrim")]: "health" } };
    renderSpine();

    expect(navigations()).toEqual([setOpenMainPage("health", false)]);
  });

  it("opens the game's first page when its remembered page can no longer be shown", () => {
    store.state.mainPage = sessionDefaultState.mainPage;
    store.state.settings.interface.lastPages = { games: { [VortexGameId("skyrim")]: "removed" } };
    renderSpine();

    expect(navigations()).toEqual([setOpenMainPage("Mods", false)]);
  });

  it("returns a picked game to its remembered page from an earlier session", () => {
    store.state.settings.interface.lastPages = { games: { [VortexGameId("stardew")]: "health" } };
    const { activate } = renderSpine();

    act(() => spine.selectGame(VortexGameId("stardew")));
    activate("stardew");

    expect(navigations().at(-1)).toEqual(setOpenMainPage("health", false));
  });

  // Fails if the spine subscribes to lastPages: each save would re-run the effect and leave the
  // hidden page.
  it("doesn't leave a hidden page when the remembered pages are saved", () => {
    const { navigate, update } = renderSpine();
    navigate("collection-view");

    store.state.settings.interface.lastPages = { games: { [VortexGameId("skyrim")]: "health" } };
    update();

    expect(navigations()).toEqual([]);
  });

  it("opens a picked game's first page when its remembered page can no longer be shown", () => {
    store.state.settings.interface.lastPages = { games: { [VortexGameId("stardew")]: "removed" } };
    const { activate } = renderSpine();

    act(() => spine.selectGame(VortexGameId("stardew")));
    activate("stardew");

    expect(navigations().at(-1)).toEqual(setOpenMainPage("Mods", false));
  });

  it("opens the active game's first page from Home when its remembered page is gone", () => {
    store.state.settings.interface.lastPages = { games: { [VortexGameId("skyrim")]: "removed" } };
    const { navigate } = renderSpine();
    navigate("Dashboard");

    act(() => spine.selectGame(VortexGameId("skyrim")));

    expect(navigations().at(-1)).toEqual(setOpenMainPage("Mods", false));
  });

  it("opens Home's first page when its remembered page is gone", () => {
    store.state.settings.interface.lastPages = { home: "removed" };
    renderSpine();

    act(() => spine.selectHome());

    expect(navigations().at(-1)).toEqual(setOpenMainPage("Dashboard", false));
  });
});
