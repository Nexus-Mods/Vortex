import { unknownToError } from "@vortex/shared";
import { useCallback, useEffect, useRef, useState } from "react";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { CatalogCache } from "./catalogCache";
import {
  appendPage,
  buildModsQuery,
  buildModsVariables,
  cacheKey,
  mapModsResponse,
  PAGE_SIZE,
  type IRawModsResponse,
} from "./catalogQuery";
import type { ICatalogMod, ICatalogPage, ICatalogSearch } from "./types";

/** Pages stay cached for 10 minutes; at most 200 pages are kept. */
const cache = new CatalogCache<ICatalogPage>({ ttlMs: 10 * 60 * 1000, maxEntries: 200 });

export function clearCatalogCache(): void {
  cache.clear();
}

export function fetchCatalogPage(
  api: IExtensionApi,
  params: ICatalogSearch,
): Promise<ICatalogPage> {
  return cache.getOrLoad(cacheKey(params), async () => {
    const query = api.ext.nexusQueryGraph;
    if (query === undefined) {
      throw new Error("Nexus Mods integration is not available");
    }
    const res = await query<IRawModsResponse>(
      buildModsQuery(params.sort),
      buildModsVariables(params),
    );
    return mapModsResponse(res);
  });
}

export type ICatalogFilters = Omit<ICatalogSearch, "offset" | "count">;

/**
 * The mods shown for the current filters, with "load more". Changing the filters starts over
 * from the first page; answers to outdated requests are dropped.
 */
export function useCatalogPages(api: IExtensionApi, filters: ICatalogFilters | undefined) {
  const [mods, setMods] = useState<ICatalogMod[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const generation = useRef(0);
  const filtersKey = JSON.stringify(filters ?? null);

  const load = useCallback(
    (offset: number) => {
      if (filters === undefined) {
        return;
      }
      const current = ++generation.current;
      (offset === 0 ? setLoading : setLoadingMore)(true);
      setError(undefined);
      fetchCatalogPage(api, { ...filters, offset, count: PAGE_SIZE })
        .then((page) => {
          if (current !== generation.current) {
            return;
          }
          setMods((prev) => (offset === 0 ? page.mods : appendPage(prev, page.mods)));
          setTotalCount(page.totalCount);
        })
        .catch((err: unknown) => {
          if (current === generation.current) {
            setError(unknownToError(err));
          }
        })
        .finally(() => {
          if (current === generation.current) {
            setLoading(false);
            setLoadingMore(false);
          }
        });
    },
    // filtersKey stands in for filters: a new object with the same content isn't a change
    [api, filtersKey],
  );

  useEffect(() => {
    setMods([]);
    setTotalCount(0);
    load(0);
  }, [load]);

  const loadMore = useCallback(() => load(mods.length), [load, mods.length]);
  const retry = useCallback(() => load(0), [load]);

  return {
    mods,
    totalCount,
    loading,
    loadingMore,
    error,
    hasMore: mods.length < totalCount,
    loadMore,
    retry,
  };
}

/** `value`, updated only once it stopped changing for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
