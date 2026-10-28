import type { ICollectionSearchOptions } from "@nexusmods/nexus-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ gameDomainName: "skyrimspecialedition" as string | undefined }));

vi.mock("../use_game_domain_name/useGameDomainName.hook", () => ({
  useGameDomainName: () => mocks.gameDomainName,
}));

import type { IExtensionApi } from "@/types/IExtensionContext";
import { queryClient } from "@/util/queryClient";

import { SORT_OPTIONS, useCollectionSearch } from "./useCollectionSearch.hook";

interface IPending {
  options: ICollectionSearchOptions;
  resolve: (result: { nodes: unknown[]; totalCount: number }) => void;
  reject: (error: Error) => void;
}

let pending: IPending[];
let requestCount: number;
let api: IExtensionApi;

/** Answers the oldest request still waiting, with one collection to show. */
const respond = (totalCount: number) =>
  act(async () => pending.shift()!.resolve({ nodes: [{ id: totalCount }], totalCount }));

/** Fails the oldest request still waiting. */
const fail = (message: string) => act(async () => pending.shift()!.reject(new Error(message)));

type ISearch = ReturnType<typeof useCollectionSearch>;

/**
 * Renders the hook against a fresh cache with the app's defaults, kept across rerenders,
 * handing every render's result to `onRender`.
 */
const render = (onRender?: (search: ISearch) => void) => {
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  return renderHook(
    () => {
      const search = useCollectionSearch(api);
      onRender?.(search);
      return search;
    },
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
};

/** Searches for `term`, as typed into the box and submitted. */
const searchFor = (result: { current: ISearch }, term: string) => {
  act(() => result.current.handleSearchQueryChange(term));
  act(() => result.current.handleSearch());
};

describe("useCollectionSearch", () => {
  beforeEach(() => {
    mocks.gameDomainName = "skyrimspecialedition";
    pending = [];
    requestCount = 0;
    api = {
      translate: (input: string) => input,
      ext: {
        nexusSearchCollections: (options: ICollectionSearchOptions) => {
          requestCount += 1;
          return new Promise((resolve, reject) => pending.push({ options, resolve, reject }));
        },
      },
    } as unknown as IExtensionApi;
  });

  it("keeps the last total while the next page loads", async () => {
    const { result } = render();
    await waitFor(() => expect(pending).toHaveLength(1));
    await respond(45);

    act(() => result.current.setCurrentPage(2));

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.totalCount).toBe(45);
  });

  it("keeps the tab's total across a sort change in a search, without counting again", async () => {
    const { result } = render();
    await waitFor(() => expect(pending).toHaveLength(1));
    await respond(45);
    act(() => result.current.handleSearchQueryChange("armour"));
    act(() => result.current.handleSearch());
    await waitFor(() => expect(pending).toHaveLength(1));
    await respond(3);

    act(() => result.current.handleSortChange(SORT_OPTIONS[0].field));

    await waitFor(() => expect(pending).toHaveLength(1));
    expect(pending[0].options.sort?.field).toBe(SORT_OPTIONS[0].field);
    expect(result.current.allCollectionsTotal).toBe(45);
  });

  it("shows a failed search's error at once, without retrying it", async () => {
    const { result } = render();
    await waitFor(() => expect(pending).toHaveLength(1));
    await respond(45);
    searchFor(result, "armour");
    await waitFor(() => expect(pending).toHaveLength(1));

    await fail("Network down");

    // Within waitFor's second: a retry would hold the error back for its first second's delay.
    await waitFor(() => expect(result.current.error?.message).toBe("Network down"));
    expect(requestCount).toBe(2);
  });

  it("keeps a failed page's total, so there are pages to move off it", async () => {
    const { result } = render();
    await waitFor(() => expect(pending).toHaveLength(1));
    await respond(45);
    act(() => result.current.setCurrentPage(2));
    await waitFor(() => expect(pending).toHaveLength(1));

    await fail("Network down");

    await waitFor(() => expect(result.current.error?.message).toBe("Network down"));
    expect(result.current.totalCount).toBe(45);
  });

  it("drops a search the API turns down as too short for the full list, saying why on the box", async () => {
    const renders: ISearch[] = [];
    const { result } = render((search) => renders.push(search));
    await waitFor(() => expect(pending).toHaveLength(1));
    await respond(45);
    searchFor(result, "a*");
    await waitFor(() => expect(pending).toHaveLength(1));

    await fail("Wildcard value must have 2 or more characters");

    await waitFor(() =>
      expect(result.current.searchValidationError).toBe("collection:browse.searchTooShort"),
    );
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.totalCount).toBe(45);
    expect(result.current.searchQuery).toBe("a*");
    expect(renders.filter((search) => search.error)).toEqual([]);
    expect(renders.filter((search) => !search.loading && !search.collections.length)).toEqual([]);

    act(() => result.current.handleSearchQueryChange("a*b"));

    expect(result.current.searchValidationError).toBe("");
  });

  it("stops a one-character search on the box, without asking the API", async () => {
    const { result } = render();
    await waitFor(() => expect(pending).toHaveLength(1));
    await respond(45);
    act(() => result.current.handleSearchQueryChange("a"));

    act(() => result.current.handleSearch());

    expect(result.current.searchValidationError).toBe("collection:browse.searchTooShort");
    expect(requestCount).toBe(1);
  });

  it("asks for nothing outside a game", async () => {
    mocks.gameDomainName = undefined;

    const { result } = render();
    await act(async () => {});

    expect(requestCount).toBe(0);
    expect(result.current.collections).toEqual([]);
  });

  it("refreshes the page and the tab's total with one request, as they're the same query", async () => {
    const { result } = render();
    await waitFor(() => expect(pending).toHaveLength(1));
    await respond(45);

    act(() => result.current.handleRefresh());

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(requestCount).toBe(2);
    await respond(46);
    await waitFor(() => expect(result.current.totalCount).toBe(46));
    expect(result.current.allCollectionsTotal).toBe(46);
  });
});
