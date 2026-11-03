import { act, fireEvent, render, screen } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { Provider } from "react-redux";
import { combineReducers, createStore, type Store } from "redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  game: undefined as { name: string } | undefined,
  tierZero: false,
  isModsEnabled: true,
  collectionsMounts: 0,
}));

vi.mock("../../../gamemode_management/selectors", () => ({
  currentGame: () => mocks.game,
}));

vi.mock("@/util/selectors", () => ({
  activeGameId: (state: { gameId: string }) => state.gameId,
}));

vi.mock("@/contexts/FlagsContext", () => ({
  useFlag: (name: string) => (mocks.isModsEnabled ? { name } : undefined),
}));

vi.mock("@/extensions/gamemode_management/tiered/tierZero", () => ({
  isTierZeroManagedGame: () => mocks.tierZero,
}));

// Fills in `{{…}}`, which the shared stub leaves alone, so the subtitle shows the game's name.
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTranslation: () => {
    const t = (key: string, options?: Record<string, string>) =>
      key.replace(/{{(\w+)}}/g, (_, name: string) => options?.[name] ?? "");
    return Object.assign([t, undefined, true], { t, i18n: undefined, ready: true });
  },
}));

vi.mock("../../hooks/use_collection_search/useCollectionSearch.hook", () => ({
  useCollectionSearch: () => ({ allCollectionsTotal: 126 }),
}));

vi.mock("../../hooks/use_mod_search/useModSearch.hook", () => ({
  useModSearch: () => ({ allModsTotal: 1480 }),
}));

vi.mock("../../components/browse_collections/BrowseCollections", () => ({
  BrowseCollections: () => {
    React.useEffect(() => {
      mocks.collectionsMounts += 1;
    }, []);
    return <div>Collections panel</div>;
  },
}));

vi.mock("../../components/browse_mods/BrowseMods", () => ({
  BrowseMods: () => <div>Mods panel</div>,
}));

vi.mock("../../components/mods_coming_soon/ModsComingSoon", () => ({
  ModsComingSoon: () => <div>Mods coming soon</div>,
}));

import type { IExtensionApi } from "@/types/IExtensionContext";

import { setBrowseSection } from "../../actions/session";
import { type IBrowseSessionState, sessionReducer } from "../../reducers/session";
import { BrowsePage } from "./BrowsePage";

const emit = vi.fn();
const api = { events: { emit } } as unknown as IExtensionApi;

/** The names of the analytics events sent. */
const tracked = () =>
  emit.mock.calls
    .filter(([bus]) => bus === "analytics-track-mixpanel-event")
    .map(([, event]) => (event as { eventName: string }).eventName);

/** Switches the active game, as the store would. */
const SET_GAME = "test/set-game";

interface ITestAction {
  type: string;
  payload?: unknown;
}

/** The state the page reads: the active game, the header's settings and Browse's real session. */
const makeStore = () =>
  createStore(
    combineReducers({
      gameId: (state: string = "skyrimse", action: ITestAction) => {
        if (action.type !== SET_GAME) {
          return state;
        }

        return action.payload as string;
      },
      settings: (state = { interface: { alwaysCompactHeaders: false } }) => state,
      session: combineReducers({
        browse: (state: IBrowseSessionState = sessionReducer.defaults, action: ITestAction) =>
          sessionReducer.reducers[action.type]?.(state, action.payload) ?? state,
      }),
    }),
  );

let store: Store;

const wrapper = ({ children }: { children?: ReactNode }) => (
  <Provider store={store}>{children}</Provider>
);

describe("BrowsePage", () => {
  beforeEach(() => {
    mocks.game = { name: "Skyrim Special Edition" };
    mocks.tierZero = false;
    mocks.isModsEnabled = true;
    mocks.collectionsMounts = 0;
    emit.mockClear();
    store = makeStore();
  });

  it("names the page and the game it browses", () => {
    render(<BrowsePage active api={api} />, { wrapper });

    expect(screen.getByText("Browse")).toBeTruthy();
    expect(screen.getByText("Discover and install mods for Skyrim Special Edition.")).toBeTruthy();
  });

  it("heads the page with the Nexus Mods pictogram", () => {
    const { container } = render(<BrowsePage active api={api} />, { wrapper });

    expect(container.querySelector('use[href="assets/pictograms/nexus-mods.svg"]')).toBeTruthy();
  });

  it("drops the game from the subtitle when there isn't one", () => {
    mocks.game = undefined;

    render(<BrowsePage active api={api} />, { wrapper });

    expect(screen.getByText("Discover and install mods.")).toBeTruthy();
  });

  it("switches between mods and collections from the header, with their counts", () => {
    render(<BrowsePage active api={api} />, { wrapper });

    expect(screen.getByRole("tab", { name: /Mods.*1,480/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Collections.*126/ })).toBeTruthy();
    expect(screen.getByText("Mods panel")).toBeTruthy();
    expect(screen.queryByText("Collections panel")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /Collections/ }));

    expect(screen.getByText("Collections panel")).toBeTruthy();
    expect(screen.queryByText("Mods panel")).toBeNull();
  });

  it("has no collections tab for a game managed without an extension", () => {
    mocks.tierZero = true;

    render(<BrowsePage active api={api} />, { wrapper });

    expect(screen.queryByRole("tab", { name: /Collections/ })).toBeNull();
    expect(screen.getByText("Mods panel")).toBeTruthy();
  });

  it("says mods are coming soon, with no count, while browsing mods is flagged off", () => {
    mocks.isModsEnabled = false;

    render(<BrowsePage active api={api} />, { wrapper });

    fireEvent.click(screen.getByRole("tab", { name: "Mods" }));

    expect(screen.getByText("Mods coming soon")).toBeTruthy();
    expect(screen.queryByText("Mods panel")).toBeNull();
  });

  it("opens on the collections while browsing mods is flagged off", () => {
    mocks.isModsEnabled = false;

    render(<BrowsePage active api={api} />, { wrapper });

    expect(screen.getByText("Collections panel")).toBeTruthy();
  });

  it("opens on the mods while browsing mods is flagged off, for a game with no collections tab", () => {
    mocks.isModsEnabled = false;
    mocks.tierZero = true;

    render(<BrowsePage active api={api} />, { wrapper });

    expect(screen.getByText("Mods coming soon")).toBeTruthy();
  });

  it("keeps the tab picked when the game changes, starting what's under it over", () => {
    render(<BrowsePage active api={api} />, { wrapper });
    fireEvent.click(screen.getByRole("tab", { name: /Collections/ }));

    act(() => {
      store.dispatch({ type: SET_GAME, payload: "fallout4" });
    });

    expect(screen.getByText("Collections panel")).toBeTruthy();
    expect(mocks.collectionsMounts).toBe(2);
  });

  it("counts the mods coming into view, opening on them or switching back to them", () => {
    render(<BrowsePage active api={api} />, { wrapper });

    expect(tracked()).toEqual(["browse_mods_viewed"]);

    fireEvent.click(screen.getByRole("tab", { name: /Collections/ }));
    fireEvent.click(screen.getByRole("tab", { name: /Mods/ }));

    expect(tracked()).toEqual(["browse_mods_viewed", "browse_mods_viewed"]);
  });

  it("counts no view while the page is hidden or browsing mods is flagged off", () => {
    const { rerender } = render(<BrowsePage active={false} api={api} />, { wrapper });

    mocks.isModsEnabled = false;
    mocks.tierZero = true;
    rerender(<BrowsePage active api={api} />);

    expect(tracked()).toEqual([]);
  });

  it("opens on the section another page asked for, and keeps it when left", () => {
    store.dispatch(setBrowseSection("collections"));

    const { rerender } = render(<BrowsePage active api={api} />, { wrapper });

    expect(screen.getByText("Collections panel")).toBeTruthy();

    rerender(<BrowsePage active={false} api={api} />);
    rerender(<BrowsePage active api={api} />);

    expect(screen.getByText("Collections panel")).toBeTruthy();
  });

  it("opens on the section asked for while it was away", () => {
    const { rerender } = render(<BrowsePage active={false} api={api} />, { wrapper });

    act(() => {
      store.dispatch(setBrowseSection("collections"));
    });
    rerender(<BrowsePage active api={api} />);

    expect(screen.getByText("Collections panel")).toBeTruthy();
  });

  it("reopens on the tab picked last", () => {
    const { rerender } = render(<BrowsePage active api={api} />, { wrapper });
    fireEvent.click(screen.getByRole("tab", { name: /Collections/ }));

    rerender(<BrowsePage active={false} api={api} />);
    rerender(<BrowsePage active api={api} />);

    expect(screen.getByText("Collections panel")).toBeTruthy();
  });

  it("shows the mods for a game without a collections tab, whatever was asked for", () => {
    mocks.tierZero = true;
    store.dispatch(setBrowseSection("collections"));

    render(<BrowsePage active api={api} />, { wrapper });

    expect(screen.getByText("Mods panel")).toBeTruthy();
  });
});
