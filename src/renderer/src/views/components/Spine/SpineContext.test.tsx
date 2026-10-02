import { act, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** A fake store: the spine reads these through the mocked selectors below. */
const store = vi.hoisted(() => ({
  state: {} as {
    mainPage: string;
    activeGameId: string | undefined;
    activeProfileId: string | undefined;
    lastActiveProfiles: Record<string, string>;
    settings: { interface: object };
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

import { setOpenMainPage } from "../../../actions/session";
import { setNextProfile } from "../../../extensions/profile_management/actions/settings";
import { SpineProvider, useSpineContext } from "./SpineContext";

let spine: ReturnType<typeof useSpineContext>;

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
      settings: { interface: {} },
      session: { base: {} },
    };
    store.dispatch = vi.fn();
    store.emit = vi.fn();
  });

  it("starts in the active game whatever is open, then opens one of its pages", () => {
    // As when switching from the classic layout, where the Games page was open.
    store.state.mainPage = "application_settings";
    renderSpine();

    expect(screen.getByTestId("selection")).toHaveTextContent("skyrim");
    expect(store.dispatch).toHaveBeenCalledWith(setOpenMainPage("Mods", false));
  });

  it("selects Home when a global page is opened by any route, game or not", () => {
    const { navigate } = renderSpine();

    navigate("application_settings");

    expect(screen.getByTestId("selection")).toHaveTextContent("home");
    expect(store.dispatch).not.toHaveBeenCalled();
  });

  it("keeps the selection for a hidden page, and doesn't navigate away from it", () => {
    const { navigate } = renderSpine();
    navigate("application_settings");

    navigate("collection-view");

    expect(screen.getByTestId("selection")).toHaveTextContent("home");
    expect(store.dispatch).not.toHaveBeenCalled();
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

    act(() => spine.selectGame("stardew"));
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

    act(() => spine.selectGame("stardew"));
    activate("stardew");

    expect(store.dispatch).toHaveBeenLastCalledWith(setOpenMainPage("health", false));
  });
});
