import { infiniteQueryOptions, skipToken } from "@tanstack/react-query";
import type { components } from "@vortex/nexus-api-v3";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { createVortexNexusV3Client } from "../../nexusV3Client";

/** A mod search, as the v3 API takes it. */
export type ModsSearchRequest = components["schemas"]["ModsSearchRequest"];

/** A mod search without its paging, which the query adds a page at a time. */
export type ModsSearch = Omit<ModsSearchRequest, "pagination">;

/** A mod in the search's results. */
export type ModSummary = components["schemas"]["ModSummary"];

/** The keys of the mod search queries. */
export const modSearchKeys = {
  /** Every mod search, which refreshing invalidates. */
  all: ["nexus", "mods", "search"] as const,
  /** One search's pages, by its request; none while it's skipped. */
  search: (search: ModsSearch | undefined) => [...modSearchKeys.all, search] as const,
};

/** The cursor the first page is asked from: none. Typed, so the pages' cursors are strings. */
const FIRST_CURSOR: string | undefined = undefined;

/**
 * A search of Nexus Mods' mods with the v3 API, a page of `pageSize` at a time by cursor, each
 * page asking from the last one's `next_cursor`, until it has none; nothing for `skipToken`. It
 * never goes stale: refetching it would ask for every page loaded again, one after another, and
 * could move mods between them, so another search is what brings newer results.
 */
export const modSearchQuery = (
  api: IExtensionApi,
  search: ModsSearch | typeof skipToken,
  pageSize: number,
) =>
  infiniteQueryOptions({
    queryKey: modSearchKeys.search(search === skipToken ? undefined : search),
    queryFn:
      search === skipToken
        ? skipToken
        : ({ pageParam }) =>
            createVortexNexusV3Client(api).searchMods({
              ...search,
              pagination: { type: "cursor", cursor: pageParam, page_size: pageSize },
            }),
    initialPageParam: FIRST_CURSOR,
    getNextPageParam: ({ meta }) => (meta.type === "cursor" && meta.next_cursor) || undefined,
    staleTime: Infinity,
  });
