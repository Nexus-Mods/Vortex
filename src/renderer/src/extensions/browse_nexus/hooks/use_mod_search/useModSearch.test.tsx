import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { components } from "@vortex/nexus-api-v3";
import React, { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { MODS_PER_PAGE, useModSearch } from "./useModSearch.hook";

const api = {} as IExtensionApi;

/** Answers the request still waiting for a preset's mods, with one mod to show. */
const respond = (sort: string, totalCount: number) =>
  act(async () => {
    const index = mocks.pending.findIndex((request) => request.search.sort.field === sort);
    const [request] = mocks.pending.splice(index, 1);
    request.resolve({ mods: [{ id: `${totalCount}` }], meta: { total_count: totalCount } });
  });

/** Fails the oldest request still waiting. */
const fail = (message: string) =>
  act(async () => mocks.pending.shift()!.reject(new Error(message)));

/** Answers the first two requests: the trending page showing, and the all-time one counted. */
const respondToStart = async (trending: number, allTime: number) => {
  await waitFor(() => expect(mocks.pending).toHaveLength(2));
  await respond("trending", trending);
  await respond("new", allTime);
};

/** Renders the hook against a fresh cache with the app's defaults, kept across rerenders. */
const render = (isEnabled = true) => {
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  return renderHook(() => useModSearch(api, { isEnabled }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
};

describe("useModSearch", () => {
  beforeEach(() => {
    mocks.gameDomainName = "skyrimspecialedition";
    mocks.pending = [];
    mocks.requestCount = 0;
  });

  it("asks for the game's trending mods, a page at a time", async () => {
    const { result } = render();
    await waitFor(() => expect(mocks.pending).toHaveLength(2));

    expect(mocks.pending.map((request) => request.search)).toContainEqual({
      filters: { games: ["skyrimspecialedition"], time_range: "7" },
      sort: { field: "trending", direction: "desc" },
      pagination: { page: 1, page_size: MODS_PER_PAGE },
    });

    await respondToStart(45, 900);

    await waitFor(() => expect(result.current.mods).toEqual([{ id: "45" }]));
    expect(result.current.totalCount).toBe(45);
  });

  it("counts the tab from every mod, over all time, whatever the preset", async () => {
    const { result } = render();
    await respondToStart(45, 900);

    await waitFor(() => expect(result.current.allModsTotal).toBe(900));
    act(() => result.current.selectPreset("popular"));
    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    await respond("popular", 12);

    await waitFor(() => expect(result.current.totalCount).toBe(12));
    expect(result.current.allModsTotal).toBe(900);
  });

  it("sorts the open preset another way from the first page, keeping the tab's total", async () => {
    const { result } = render();
    await respondToStart(45, 900);
    act(() => result.current.setCurrentPage(2));
    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    await respond("trending", 45);

    act(() => result.current.setSort({ field: "endorsements", timeRange: "28" }));

    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    expect(mocks.pending[0].search).toMatchObject({
      filters: { time_range: "28" },
      sort: { field: "endorsements", direction: "desc" },
      pagination: { page: 1 },
    });
    expect(result.current.currentPage).toBe(1);
    expect(result.current.canResetSort).toBe(true);
    await respond("endorsements", 30);
    await waitFor(() => expect(result.current.totalCount).toBe(30));
    expect(result.current.allModsTotal).toBe(900);
  });

  it("keeps each preset's sort to itself, until it's reset to how it came", async () => {
    const { result } = render();
    await respondToStart(45, 900);
    act(() => result.current.setSort({ direction: "asc" }));

    act(() => result.current.selectPreset("popular"));

    expect(result.current.sort).toEqual({ field: "popular", direction: "desc", timeRange: "7" });
    expect(result.current.canResetSort).toBe(false);

    act(() => result.current.selectPreset("trending"));

    expect(result.current.sort.direction).toBe("asc");

    act(() => result.current.resetSort());

    expect(result.current.sort).toEqual({ field: "trending", direction: "desc", timeRange: "7" });
    expect(result.current.canResetSort).toBe(false);
  });

  it("keeps the last total while the next page loads", async () => {
    const { result } = render();
    await respondToStart(45, 900);

    act(() => result.current.setCurrentPage(2));

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(mocks.pending[0].search.pagination.page).toBe(2);
    expect(result.current.totalCount).toBe(45);
  });

  it("shows another preset from the first page, from the count's request when it's all-time", async () => {
    const { result } = render();
    await respondToStart(45, 900);
    act(() => result.current.setCurrentPage(2));
    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    await respond("trending", 45);

    act(() => result.current.selectPreset("new"));

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
    expect(mocks.pending[0].search.pagination.page).toBe(2);
    await respond("trending", 45);

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
