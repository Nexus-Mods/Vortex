import { QueryClient, skipToken } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ searchMods: vi.fn() }));

vi.mock("../../nexusV3Client", () => ({
  createVortexNexusV3Client: () => ({ searchMods: mocks.searchMods }),
}));

import type { IExtensionApi } from "@/types/IExtensionContext";
import { queryClient } from "@/util/queryClient";

import { type ModsSearch, modSearchKeys, modSearchQuery } from "./modSearch.query";

const api = {} as IExtensionApi;

const search: ModsSearch = {
  filters: { games: ["skyrimspecialedition"] },
  sort: { field: "endorsements", direction: "desc" },
};

/** A page of the search's results, followed by the page `next_cursor` points at, if any. */
const page = (id: string, nextCursor: string | null) => ({
  mods: [{ id }],
  meta: { type: "cursor", page_size: 20, total_count: 45, next_cursor: nextCursor },
});

const client = () => new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });

describe("modSearchQuery", () => {
  it("asks for the first page by cursor, with no cursor, and returns the API's result", async () => {
    mocks.searchMods.mockResolvedValue(page("1", "next"));

    const result = await client().fetchInfiniteQuery(modSearchQuery(api, search, 20));

    expect(mocks.searchMods).toHaveBeenCalledWith({
      ...search,
      pagination: { type: "cursor", cursor: undefined, page_size: 20 },
    });
    expect(result.pages).toEqual([page("1", "next")]);
  });

  it("keeps a search it has fresh however long ago, rather than asking for every page again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    mocks.searchMods.mockClear();
    mocks.searchMods.mockResolvedValue(page("1", null));
    const queries = client();

    try {
      await queries.fetchInfiniteQuery(modSearchQuery(api, search, 20));
      vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000);
      await queries.fetchInfiniteQuery(modSearchQuery(api, search, 20));

      expect(mocks.searchMods).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("asks for each next page from the last one's cursor", () => {
    const { getNextPageParam } = modSearchQuery(api, search, 20);

    expect(getNextPageParam(page("1", "abc") as never, [], undefined, [])).toBe("abc");
  });

  it("stops at the page with no next cursor", () => {
    const { getNextPageParam } = modSearchQuery(api, search, 20);

    expect(getNextPageParam(page("1", null) as never, [], undefined, [])).toBeUndefined();
  });

  it("keys each search by its request, under every search's key", () => {
    expect(modSearchQuery(api, search, 20).queryKey).toEqual([...modSearchKeys.all, search]);
  });

  it("asks for nothing when it's skipped", () => {
    expect(modSearchQuery(api, skipToken, 20).queryFn).toBe(skipToken);
  });
});
