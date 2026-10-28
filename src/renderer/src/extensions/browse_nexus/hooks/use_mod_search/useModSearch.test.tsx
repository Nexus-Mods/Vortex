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

/** Answers the oldest request still waiting, with one mod to show. */
const respond = (totalCount: number) =>
  act(async () =>
    mocks.pending
      .shift()!
      .resolve({ mods: [{ id: `${totalCount}` }], meta: { total_count: totalCount } }),
  );

/** Fails the oldest request still waiting. */
const fail = (message: string) =>
  act(async () => mocks.pending.shift()!.reject(new Error(message)));

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
    await waitFor(() => expect(mocks.pending).toHaveLength(1));

    expect(mocks.pending[0].search).toEqual({
      filters: { games: ["skyrimspecialedition"] },
      sort: { field: "trending", direction: "desc" },
      pagination: { page: 1, page_size: MODS_PER_PAGE },
    });

    await respond(45);

    await waitFor(() => expect(result.current.mods).toEqual([{ id: "45" }]));
    expect(result.current.totalCount).toBe(45);
    expect(result.current.allModsTotal).toBe(45);
  });

  it("keeps the last total while the next page loads", async () => {
    const { result } = render();
    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    await respond(45);

    act(() => result.current.setCurrentPage(2));

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(mocks.pending[0].search.pagination.page).toBe(2);
    expect(result.current.totalCount).toBe(45);
  });

  it("asks for another preset's sort from the first page, keeping the tab's total", async () => {
    const { result } = render();
    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    await respond(45);
    act(() => result.current.setCurrentPage(2));
    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    await respond(45);

    act(() => result.current.selectPreset("new"));

    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    expect(mocks.pending[0].search.sort.field).toBe("new");
    expect(mocks.pending[0].search.pagination.page).toBe(1);
    expect(result.current.currentPage).toBe(1);
    await respond(900);
    await waitFor(() => expect(result.current.totalCount).toBe(900));
    expect(result.current.allModsTotal).toBe(45);
    expect(mocks.requestCount).toBe(3);
  });

  it("shows a failed page's error at once, keeping its total, without retrying it", async () => {
    const { result } = render();
    await waitFor(() => expect(mocks.pending).toHaveLength(1));
    await respond(45);
    act(() => result.current.setCurrentPage(2));
    await waitFor(() => expect(mocks.pending).toHaveLength(1));

    await fail("Network down");

    // Within waitFor's second: a retry would hold the error back for its first second's delay.
    await waitFor(() => expect(result.current.error?.message).toBe("Network down"));
    expect(result.current.totalCount).toBe(45);
    expect(mocks.requestCount).toBe(2);
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
