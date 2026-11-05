import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { components } from "@vortex/nexus-api-v3";
import React, { type ReactNode } from "react";
import { Provider } from "react-redux";
import { combineReducers, createStore, type Store } from "redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ModsSearchRequest = components["schemas"]["ModsSearchRequest"];

interface IPending {
  search: ModsSearchRequest;
  resolve: (result: { mods: unknown[]; meta: { total_count: number } }) => void;
  reject: (error: Error) => void;
}

const mocks = vi.hoisted(() => ({
  gameDomainName: "skyrimspecialedition" as string | undefined,
  pending: [] as IPending[],
  requestCount: 0,
  canSeeAdult: true,
  hasUserInfo: true,
}));

vi.mock("../use_game_domain_name/useGameDomainName.hook", () => ({
  useGameDomainName: () => mocks.gameDomainName,
}));
vi.mock("@/extensions/nexus_integration/nexusV3Client", () => ({
  createVortexNexusV3Client: () => ({
    searchMods: (search: ModsSearchRequest) => {
      mocks.requestCount += 1;
      return new Promise((resolve, reject) => mocks.pending.push({ search, resolve, reject }));
    },
  }),
}));

import type { IExtensionApi } from "@/types/IExtensionContext";
import { queryClient } from "@/util/queryClient";

import {
  browseModsViewsReducer,
  type IBrowseModsView,
  type IBrowseModsViewsState,
} from "../../reducers/mods_views/modsViews";
import { type IBrowseSessionState, sessionReducer } from "../../reducers/session";
import { MODS_PER_PAGE, useModSearch } from "./useModSearch.hook";

/** The time the tests start at, which the first time range counts back from. */
const NOW = Date.parse("2026-11-03T14:35:00Z");

const HOUR_MS = 60 * 60 * 1000;

/** The start of a range of so many days back from a time, `NOW` unless given. */
const daysBack = (days: number, from = NOW) => new Date(from - days * 24 * HOUR_MS).toISOString();

const api = {} as IExtensionApi;

/** Answers the request still waiting for a preset's mods, with one mod to show. */
const respond = (sort: string, totalCount: number) =>
  act(async () => {
    const index = mocks.pending.findIndex((request) => request.search.sort.field === sort);
    const [request] = mocks.pending.splice(index, 1);
    request.resolve({ mods: [{ id: `${totalCount}` }], meta: { total_count: totalCount } });
  });

/** The page a request asks for, by number as Browse pages. */
const pageOf = (search: ModsSearchRequest) =>
  search.pagination.type === "page" ? search.pagination.page : undefined;

/** Fails the oldest request still waiting. */
const fail = (message: string) =>
  act(async () => mocks.pending.shift()!.reject(new Error(message)));

/** Answers the first two requests: the trending page showing, and the all-time one counted. */
const respondToStart = async (trending: number, allTime: number) => {
  await waitFor(() => expect(mocks.pending).toHaveLength(2));
  await respond("endorsements", trending);
  await respond("new", allTime);
};

interface ITestAction {
  type: string;
  payload?: unknown;
}

/** A store with Browse's real saved views, as settings keep them, starting from `views`. */
const makeStore = (views: IBrowseModsViewsState = browseModsViewsReducer.defaults) =>
  createStore(
    combineReducers({
      settings: combineReducers({
        browseModsViews: (state: IBrowseModsViewsState = views, action: ITestAction) =>
          browseModsViewsReducer.reducers[action.type]?.(state, action.payload) ?? state,
      }),
      session: combineReducers({
        browse: (state: IBrowseSessionState = sessionReducer.defaults, action: ITestAction) =>
          sessionReducer.reducers[action.type]?.(state, action.payload) ?? state,
      }),
      persistent: (
        state = {
          nexus: { userInfo: mocks.hasUserInfo ? { adult: mocks.canSeeAdult } : undefined },
        },
      ) => state,
      confidential: (state = { account: { nexus: { APIKey: "key" } } }) => state,
    }),
  );

let store: Store;

/** The views the store keeps. */
const savedViews = (): IBrowseModsViewsState => store.getState().settings.browseModsViews;

/**
 * Renders the hook against a fresh cache with the app's defaults and a store of saved views, kept
 * across rerenders.
 */
const render = (isEnabled = true, views?: IBrowseModsViewsState) => {
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  store = makeStore(views);
  return renderHook(() => useModSearch(api, { isEnabled }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <Provider store={store}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </Provider>
    ),
  });
};

describe("useModSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
    mocks.gameDomainName = "skyrimspecialedition";
    mocks.pending = [];
    mocks.requestCount = 0;
    mocks.canSeeAdult = true;
    mocks.hasUserInfo = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks for the game's trending mods, a page at a time", async () => {
    const { result } = render();
    await waitFor(() => expect(mocks.pending).toHaveLength(2));

    expect(mocks.pending.map((request) => request.search)).toContainEqual({
      filters: { games: ["skyrimspecialedition"], created_at: { gte: daysBack(7) } },
      sort: { field: "endorsements", direction: "desc" },
      pagination: { type: "page", page: 1, page_size: MODS_PER_PAGE },
    });

    await respondToStart(45, 900);

    await waitFor(() => expect(result.current.mods).toEqual([{ id: "45" }]));
    expect(result.current.totalCount).toBe(45);
  });

  it("counts the tab from every mod, over all time, whatever the preset", async () => {
    const { result } = render();
    await respondToStart(45, 900);

    await waitFor(() => expect(result.current.allModsTotal).toBe(900));
    act(() => result.current.selectView("popular"));
    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    await respond("downloads", 12);

    await waitFor(() => expect(result.current.totalCount).toBe(12));
    expect(result.current.allModsTotal).toBe(900);
  });

  it("sorts the open preset another way from the first page, keeping the tab's total", async () => {
    const { result } = render();
    await respondToStart(45, 900);
    act(() => result.current.setCurrentPage(2));
    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    await respond("endorsements", 45);

    act(() => result.current.setSort({ field: "downloads" }));

    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    expect(mocks.pending[0].search).toMatchObject({
      filters: { created_at: { gte: daysBack(7) } },
      sort: { field: "downloads", direction: "desc" },
      pagination: { page: 1 },
    });
    expect(result.current.currentPage).toBe(1);
    expect(result.current.canResetSort).toBe(true);
    await respond("downloads", 30);
    await waitFor(() => expect(result.current.totalCount).toBe(30));
    expect(result.current.allModsTotal).toBe(900);
  });

  it("keeps each preset's sort to itself, until it's reset to how it came", async () => {
    const { result } = render();
    await respondToStart(45, 900);
    act(() => result.current.setSort({ direction: "asc" }));

    act(() => result.current.selectView("popular"));

    expect(result.current.sort).toEqual({ field: "downloads", direction: "desc" });
    expect(result.current.canResetSort).toBe(false);

    act(() => result.current.selectView("trending"));

    expect(result.current.sort.direction).toBe("asc");

    act(() => result.current.resetSort());

    expect(result.current.sort).toEqual({ field: "endorsements", direction: "desc" });
    expect(result.current.canResetSort).toBe(false);
  });

  it("filters the open preset by time from the first page, as a filter rather than its sort", async () => {
    const { result } = render();
    await respondToStart(45, 900);
    act(() => result.current.setCurrentPage(2));
    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    await respond("endorsements", 45);

    act(() => result.current.setFilters({ timeRange: "28" }));

    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    expect(mocks.pending[0].search).toMatchObject({
      filters: { created_at: { gte: daysBack(28) } },
      sort: { field: "endorsements", direction: "desc" },
      pagination: { page: 1 },
    });
    expect(result.current.currentPage).toBe(1);
    expect(result.current.filters).toEqual({ timeRange: "28", adult: "include" });
    expect(result.current.canResetSort).toBe(false);
  });

  it("asks for mods by adult content only once it narrows them", async () => {
    const { result } = render();
    await respondToStart(45, 900);
    expect(mocks.pending).toEqual([]);

    act(() => result.current.setFilters({ adult: "only" }));

    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    expect(mocks.pending[0].search.filters).toMatchObject({ adult: "only" });
    expect(result.current.activeFilterCount).toBe(2);
  });

  it("asks for no adult mods for a user who can't see them, whatever the view says", async () => {
    mocks.canSeeAdult = false;
    const { result } = render();
    await waitFor(() => expect(mocks.pending.length).toBeGreaterThan(0));

    expect(mocks.pending.map((request) => request.search.filters.adult)).toContain("exclude");
    expect(result.current.filters.adult).toBe("exclude");
    expect(result.current.isEdited).toBe(false);
  });

  it("doesn't lock adult content while a logged-in user's preferences are still loading", async () => {
    mocks.hasUserInfo = false;
    const { result } = render();
    await waitFor(() => expect(mocks.pending.length).toBeGreaterThan(0));

    expect(result.current.canSeeAdult).toBe(true);
    expect(result.current.filters.adult).toBe("include");
    expect(mocks.pending.map((request) => request.search.filters.adult)).not.toContain("exclude");
  });

  it("counts a time range as a filter, and none over all time", async () => {
    const { result } = render();
    await respondToStart(45, 900);

    expect(result.current.activeFilterCount).toBe(1);

    act(() => result.current.selectView("new"));

    expect(result.current.filters).toEqual({ timeRange: "all", adult: "include" });
    expect(result.current.activeFilterCount).toBe(0);
  });

  it("counts only the filters that differ from the open preset's own", async () => {
    const { result } = render();
    await respondToStart(45, 900);

    expect(result.current.changedFilterCount).toBe(0);

    act(() => result.current.setFilters({ timeRange: "all" }));

    expect(result.current.changedFilterCount).toBe(1);

    act(() => result.current.selectView("new"));

    expect(result.current.changedFilterCount).toBe(0);
  });

  it("puts the open preset's filters back as they came, leaving its sort", async () => {
    const { result } = render();
    await respondToStart(45, 900);
    act(() => result.current.setSort({ direction: "asc" }));
    act(() => result.current.setFilters({ timeRange: "365" }));

    act(() => result.current.resetFilters());

    expect(result.current.filters).toEqual({ timeRange: "7", adult: "include" });
    expect(result.current.changedFilterCount).toBe(0);
    expect(result.current.sort.direction).toBe("asc");
  });

  it("resets the open preset's sort without touching its filters", async () => {
    const { result } = render();
    await respondToStart(45, 900);
    act(() => result.current.setFilters({ timeRange: "365" }));
    act(() => result.current.setSort({ direction: "asc" }));

    act(() => result.current.resetSort());

    expect(result.current.sort.direction).toBe("desc");
    expect(result.current.filters).toEqual({ timeRange: "365", adult: "include" });
  });

  it("puts a preset's own time range back whenever it's picked, even the one open", async () => {
    const { result } = render();
    await respondToStart(45, 900);
    act(() => result.current.setFilters({ timeRange: "1" }));

    act(() => result.current.selectView("new"));

    expect(result.current.filters).toEqual({ timeRange: "all", adult: "include" });

    act(() => result.current.setFilters({ timeRange: "28" }));
    act(() => result.current.selectView("trending"));

    expect(result.current.filters).toEqual({ timeRange: "7", adult: "include" });

    act(() => result.current.resetFilters());
    act(() => result.current.selectView("trending"));

    expect(result.current.filters).toEqual({ timeRange: "7", adult: "include" });
  });

  it("keeps a page's search as time passes, so it isn't fetched again", async () => {
    const { result, rerender } = render();
    await respondToStart(45, 900);
    const requests = mocks.requestCount;

    vi.setSystemTime(NOW + 2 * HOUR_MS);
    rerender();

    expect(mocks.requestCount).toBe(requests);
    expect(result.current.totalCount).toBe(45);
  });

  it("counts a range back from when it's picked", async () => {
    const { result } = render();
    await respondToStart(45, 900);
    const later = NOW + 2 * HOUR_MS;
    vi.setSystemTime(later);

    act(() => result.current.setFilters({ timeRange: "28" }));

    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    expect(mocks.pending[0].search.filters).toMatchObject({
      created_at: { gte: daysBack(28, later) },
    });
  });

  it("keeps the last total while the next page loads", async () => {
    const { result } = render();
    await respondToStart(45, 900);

    act(() => result.current.setCurrentPage(2));

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(pageOf(mocks.pending[0].search)).toBe(2);
    expect(result.current.totalCount).toBe(45);
  });

  it("shows another preset from the first page, from the count's request when it's all-time", async () => {
    const { result } = render();
    await respondToStart(45, 900);
    act(() => result.current.setCurrentPage(2));
    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    await respond("endorsements", 45);

    act(() => result.current.selectView("new"));

    await waitFor(() => expect(result.current.totalCount).toBe(900));
    expect(result.current.currentPage).toBe(1);
    expect(result.current.mods).toEqual([{ id: "900" }]);
    expect(mocks.requestCount).toBe(3);
  });

  it("shows a failed page's error at once, keeping its total, without retrying it", async () => {
    const { result } = render();
    await respondToStart(45, 900);
    act(() => result.current.setCurrentPage(2));
    await waitFor(() => expect(mocks.pending).toHaveLength(1));

    await fail("Network down");

    // Within waitFor's second: a retry would hold the error back for its first second's delay.
    await waitFor(() => expect(result.current.error?.message).toBe("Network down"));
    expect(result.current.totalCount).toBe(45);
    expect(mocks.requestCount).toBe(3);
  });

  it("asks for a failed page again when retried, and shows it once it comes", async () => {
    const { result } = render();
    await respondToStart(45, 900);
    act(() => result.current.setCurrentPage(2));
    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    await fail("Network down");
    await waitFor(() => expect(result.current.error).toBeTruthy());

    act(() => result.current.retry());
    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    expect(pageOf(mocks.pending[0].search)).toBe(2);
    await respond("endorsements", 45);

    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.mods).toEqual([{ id: "45" }]);
  });

  it("asks for nothing outside a game", async () => {
    mocks.gameDomainName = undefined;

    const { result } = render();
    await act(async () => {});

    expect(mocks.requestCount).toBe(0);
    expect(result.current.mods).toEqual([]);
  });

  it("asks for nothing while it's turned off", async () => {
    const { result } = render(false);
    await act(async () => {});

    expect(mocks.requestCount).toBe(0);
    expect(result.current.allModsTotal).toBe(0);
  });
});

describe("useModSearch's views", () => {
  /** A view of the user's own, most downloaded over the last 28 days. */
  const mine: IBrowseModsView = {
    id: "custom-1",
    name: "Mine",
    sort: { field: "downloads", direction: "desc" },
    filters: { timeRange: "28" },
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
    mocks.gameDomainName = "skyrimspecialedition";
    mocks.pending = [];
    mocks.requestCount = 0;
    mocks.canSeeAdult = true;
    mocks.hasUserInfo = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens on the view open last time, searching as it saved", async () => {
    const { result } = render(true, { selected: "custom-1", custom: [mine] });

    expect(result.current.viewId).toBe("custom-1");
    expect(result.current.trackedView).toBe("custom");
    await waitFor(() => expect(mocks.pending.length).toBeGreaterThan(0));
    expect(mocks.pending.map((request) => request.search)).toContainEqual(
      expect.objectContaining({
        filters: { games: ["skyrimspecialedition"], created_at: { gte: daysBack(28) } },
        sort: { field: "downloads", direction: "desc" },
      }),
    );
  });

  it("opens on the first preset when the view open last time is gone", () => {
    const { result } = render(true, { selected: "custom-gone", custom: [] });

    expect(result.current.viewId).toBe("trending");
  });

  it("remembers the view opened", () => {
    const { result } = render();

    act(() => result.current.selectView("new"));

    expect(savedViews().selected).toBe("new");
  });

  it("saves what's showing as a view of the user's own, and opens it", () => {
    const { result } = render();
    act(() => result.current.setSort({ field: "downloads" }));

    act(() => result.current.addView("Downloads this week"));

    expect(savedViews().custom).toEqual([
      expect.objectContaining({
        name: "Downloads this week",
        sort: { field: "downloads", direction: "desc" },
        filters: { timeRange: "7", adult: "include" },
      }),
    ]);
    expect(result.current.viewId).toBe(savedViews().custom[0].id);
  });

  it("puts a preset back as it comes once what's showing of it is saved as a view", () => {
    const { result } = render();
    act(() => result.current.setSort({ field: "downloads" }));
    act(() => result.current.setFilters({ timeRange: "28" }));

    act(() => result.current.addView("Downloads this month"));
    act(() => result.current.selectView("trending"));

    expect(result.current.isEdited).toBe(false);
    expect(result.current.sort).toEqual({ field: "endorsements", direction: "desc" });
  });

  it("saves the adult content choice as stored, not as locked for a user who can't see it", () => {
    mocks.canSeeAdult = false;
    const { result } = render(true, {
      selected: "custom-1",
      custom: [{ ...mine, filters: { timeRange: "28", adult: "only" } }],
    });
    expect(result.current.filters.adult).toBe("exclude");

    act(() => result.current.addView("Copy"));

    expect(savedViews().custom[1].filters).toEqual({ timeRange: "28", adult: "only" });
  });

  it("saves a view's changes of sort and filters into it, so it's never edited", () => {
    const { result } = render(true, { selected: "custom-1", custom: [mine] });

    act(() => result.current.setSort({ direction: "asc" }));
    act(() => result.current.setFilters({ timeRange: "all" }));

    expect(savedViews().custom[0]).toMatchObject({
      sort: { field: "downloads", direction: "asc" },
      filters: { timeRange: "all" },
    });
    expect(result.current.isEdited).toBe(false);
    expect(result.current.canResetSort).toBe(false);
  });

  it("goes by no filter for one a view was saved without", () => {
    const { result } = render(true, {
      selected: "custom-1",
      custom: [{ ...mine, filters: {} }],
    });

    expect(result.current.filters).toEqual({ timeRange: "all", adult: "include" });
  });

  it("is edited while a preset's sort or filters differ from how it comes, until it's reset", () => {
    const { result } = render();
    expect(result.current.isEdited).toBe(false);

    act(() => result.current.setFilters({ timeRange: "28" }));
    expect(result.current.isEdited).toBe(true);

    act(() => result.current.resetView());
    expect(result.current.isEdited).toBe(false);
    expect(result.current.filters).toEqual({ timeRange: "7", adult: "include" });
  });

  it("renames and deletes a view, going back to the first preset if it was open", () => {
    const { result } = render(true, { selected: "custom-1", custom: [mine] });

    act(() => result.current.renameView("custom-1", "Theirs"));
    expect(result.current.views[0].name).toBe("Theirs");

    act(() => result.current.removeView("custom-1"));
    expect(result.current.views).toEqual([]);
    expect(result.current.viewId).toBe("trending");
  });

  it("opens the first preset as picking it would when the open view is deleted", () => {
    const { result } = render(true, { selected: "trending", custom: [mine] });
    act(() => result.current.setFilters({ timeRange: "28" }));
    act(() => result.current.selectView("custom-1"));
    const later = NOW + 2 * HOUR_MS;
    vi.setSystemTime(later);

    act(() => result.current.removeView("custom-1"));

    expect(result.current.viewId).toBe("trending");
    expect(result.current.filters).toEqual({ timeRange: "7", adult: "include" });
    expect(result.current.isEdited).toBe(false);
    expect(result.current.rangeFrom).toBe(later);
  });
});
