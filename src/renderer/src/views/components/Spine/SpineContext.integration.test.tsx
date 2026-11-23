/**
 * The spine with a real store, real reducers and the real PagesProvider, using the page ids and
 * priorities extensions register. SpineContext.test.tsx fakes all of these.
 */
import { act, render } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import { type AnyAction, createStore } from "redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IMainPage } from "../../../types/IMainPage";

const app = vi.hoisted(() => ({
  pages: [] as IMainPage[],
  /** Visibility by page id; pages not listed are visible. */
  hidden: new Set<string>(),
  getState: (): unknown => undefined,
}));

vi.mock("../../../hooks/useMainPages", () => ({ useMainPages: () => app.pages }));

/** Built-in pages pull in their components; the registered pages are enough. */
vi.mock("../../../contexts/builtInPages", () => ({ builtInPages: [] }));

vi.mock("../../../contexts/MainContext", () => ({
  useMainContext: () => ({
    api: {
      getState: () => app.getState(),
      events: { emit: vi.fn(), on: vi.fn(), once: vi.fn(), removeListener: vi.fn() },
    },
  }),
}));

import { VortexGameId } from "@vortex/shared";

import { setOpenMainPage } from "../../../actions/session";
import { PagesProvider } from "../../../contexts/PagesContext";
import interfaceReducer from "../../../extensions/settings_interface/reducers/interface";
import { sessionReducer } from "../../../reducers/session";
import type { ISettingsInterface } from "../../../types/IState";
import { SpineProvider } from "./SpineContext";

const GAME = VortexGameId("skyrim");

const defaultInterface: ISettingsInterface = {
  language: "en",
  advanced: false,
  profilesVisible: true,
  desktopNotifications: false,
  hideTopLevelCategory: false,
  relativeTimes: true,
  alwaysCompactHeaders: false,
  showGameArt: true,
  dashboardLayout: [],
  foregroundDL: true,
  dashletSettings: {},
  usage: {},
};

/** A page as registered: the id is the title unless set. */
const page = (title: string, group: IMainPage["group"], priority: number): IMainPage => ({
  id: title,
  title,
  group,
  priority,
  icon: "",
  component: () => null,
  propsFunc: () => ({}),
  visible: () => !app.hidden.has(title),
});

/** Ids and priorities as registered today. */
const registeredPages = [
  page("Browse", "per-game", 0),
  page("Mods", "per-game", 1),
  page("Collections", "per-game", 10),
  page("Health check", "per-game", 60),
  page("Dashboard", "dashboard", 1),
  page("Games", "global", 10),
];

/** A fresh start: session defaults, the given persisted settings, one active profile. */
const makeStore = (settingsInterface: Partial<ISettingsInterface> = {}) => {
  const initial = {
    session: { base: sessionReducer.defaults },
    settings: {
      interface: { ...defaultInterface, ...settingsInterface },
      window: { useModernLayout: true },
      profiles: { activeProfileId: "profile", lastActiveProfile: { [GAME]: "profile" } },
    },
    persistent: { profiles: { profile: { id: "profile", gameId: GAME } } },
  };

  const store = createStore((state: typeof initial = initial, action: AnyAction) => {
    const reduceSession = sessionReducer.reducers[action.type];
    if (reduceSession) {
      return { ...state, session: { base: reduceSession(state.session.base, action.payload) } };
    }
    const reduceInterface = interfaceReducer.reducers[action.type];
    if (reduceInterface) {
      return {
        ...state,
        settings: {
          ...state.settings,
          interface: reduceInterface(state.settings.interface, action.payload),
        },
      };
    }
    return state;
  });
  app.getState = () => store.getState();
  return store;
};

/** Mounts the providers the way AppLayout and ModernLayout nest them. */
const start = (store: ReturnType<typeof makeStore>) =>
  render(
    <Provider store={store}>
      <PagesProvider>
        <SpineProvider>{null}</SpineProvider>
      </PagesProvider>
    </Provider>,
  );

const openPage = (store: ReturnType<typeof makeStore>) => store.getState().session.base.mainPage;
const remembered = (store: ReturnType<typeof makeStore>) =>
  store.getState().settings.interface.lastPages?.games?.[GAME];

describe("SpineProvider in the app's store", () => {
  beforeEach(() => {
    app.pages = registeredPages;
    app.hidden = new Set();
  });

  it("reopens the page left open in the active game after a restart", () => {
    const store = makeStore({ lastPages: { games: { [GAME]: "Health check" } } });
    start(store);

    expect(openPage(store)).toBe("Health check");
  });

  // The fallback, not the intent.
  it("falls back to the game's first page by priority when nothing is remembered", () => {
    const store = makeStore();
    start(store);

    expect(openPage(store)).toBe("Browse");
  });

  it("remembers the page the user opens", () => {
    const store = makeStore();
    start(store);

    act(() => {
      store.dispatch(setOpenMainPage("Collections", false));
    });

    expect(remembered(store)).toBe("Collections");
  });

  // E.g. a late feature flag. Saving the fallback would lose the page for every later restart.
  it("keeps a remembered page that isn't visible at startup, and reopens it once it is", () => {
    app.hidden = new Set(["Health check"]);
    const first = makeStore({ lastPages: { games: { [GAME]: "Health check" } } });
    const firstRun = start(first);

    expect(openPage(first)).toBe("Browse");
    expect(remembered(first)).toBe("Health check");

    firstRun.unmount();
    app.hidden = new Set();
    const second = makeStore({ lastPages: first.getState().settings.interface.lastPages });
    start(second);

    expect(openPage(second)).toBe("Health check");
  });
});
