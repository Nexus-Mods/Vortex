import {
  keepPreviousData,
  skipToken,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { V3ApiError } from "@vortex/nexus-api-v3";
import type { GameDomain } from "@vortex/shared";
import { useMemo, useState } from "react";

import {
  type ModsSearch,
  type ModSummary,
  modSearchQuery,
} from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { filtersToSearch } from "../../util/mod_filters/modFilterList";
import {
  type IModFilters,
  type IModSort,
  ModPreset,
  PRESET_FILTERS,
  PRESET_SORTS,
} from "../../util/mod_views/modViews";
import { useGameDomainName } from "../use_game_domain_name/useGameDomainName.hook";
import { useModViews } from "../use_mod_views/useModViews.hook";

/**
 * The preset the tab's total is counted with, as it comes: the one over all time, as trending
 * and popular cover only the last week.
 */
const COUNTED_PRESET: ModPreset = ModPreset.new;

export const MODS_PER_PAGE = 20;

interface IModsSearch {
  /** The game whose mods to search; none searches nothing. */
  gameDomainName: GameDomain | undefined;
  /** How they're sorted. */
  sort: IModSort;
  /** Which of them to show. */
  filters: IModFilters;
  /** When the time range was picked, which it counts back from, in ms. */
  rangeFrom: number;
}

/**
 * The search for a game's mods, sorted and filtered; none outside a game. Only mods that can be
 * installed with a mod manager, as Vortex can't install the rest.
 */
const searchFor = ({
  gameDomainName,
  sort,
  filters,
  rangeFrom,
}: IModsSearch): ModsSearch | typeof skipToken => {
  if (!gameDomainName) {
    return skipToken;
  }

  return {
    filters: {
      games: [gameDomainName],
      ...filtersToSearch(filters, { sortField: sort.field, rangeFrom }),
      supports_mod_managers: true,
    },
    sort: { field: sort.field, direction: sort.direction },
  };
};

/** The pages' mods in order, each only where it first came, as a mod that moves can repeat. */
const uniqueMods = (pages: { mods: ModSummary[] }[] | undefined): ModSummary[] => {
  const byId = new Map<string, ModSummary>();

  for (const mod of (pages ?? []).flatMap((page) => page.mods)) {
    if (!byId.has(mod.id)) {
      byId.set(mod.id, mod);
    }
  }

  return [...byId.values()];
};

/**
 * Whether a page failed as the API refused its cursor, as it does one made before an update. Only a
 * later page has one, sent with the same search the first page was accepted with, so its `422` can
 * only be the cursor's; the API says nothing more specific.
 */
const isRefusedCursor = (error: Error | null) =>
  error instanceof V3ApiError && error.status === 422;

interface IModSearchOptions {
  /** Whether to search at all; off, it asks for nothing. */
  isEnabled: boolean;
}

/** The active game's mods by the open view, and the view itself, from `useModViews`. */
export interface IModSearch extends ReturnType<typeof useModViews> {
  /** The search the mods are from, by query key and view, and changing as it starts again. */
  searchKey: string;
  /** The mods loaded so far, each only where it first came. */
  mods: ModSummary[];
  /** How many mods the search found; the last search's until the next one's first page comes. */
  totalCount: number;
  /** How many of the game's mods a mod manager can install, over all time, whatever the view. */
  allModsTotal: number;
  /** Whether the first page is loading with nothing of it to show; asking again keeps the mods. */
  loading: boolean;
  /** Why the first page failed to load, with no mods to show. */
  error: Error | null;
  /** Whether a page is loading with mods on screen: the next, or the first again. */
  isLoadingMore: boolean;
  /** Why a page failed with mods to show, until it's asked for again. */
  loadMoreError: Error | null;
  /** Whether there are pages left to load, and nothing loading that would keep one from loading. */
  hasMore: boolean;
  /** How many pages have loaded. */
  pagesLoaded: number;
  /** Loads the next page, unless one is loading, it's failed, or there are none left. */
  loadMore: () => void;
  /** Asks for the failed page again; a refused cursor starts the list again from the top. */
  retry: () => void;
}

/**
 * The active game's mods by the open view, from `useModViews`, a page more at a time as
 * `loadMore` asks; any change to the view or its search starts again from the first page.
 */
export const useModSearch = (api: IExtensionApi, { isEnabled }: IModSearchOptions): IModSearch => {
  const gameDomainName = useGameDomainName();
  const searchedGame = isEnabled ? gameDomainName : undefined;
  const views = useModViews();
  const { sort, filters, rangeFrom } = views;
  const queryClient = useQueryClient();
  const [restarts, setRestarts] = useState(0);

  const search = modSearchQuery(
    api,
    searchFor({ gameDomainName: searchedGame, sort, filters, rangeFrom }),
    MODS_PER_PAGE,
  );

  /** The pages loaded; it keeps the last search's while another's first page loads. */
  const mods = useInfiniteQuery({ ...search, placeholderData: keepPreviousData });

  /**
   * The tab's total, every one of the game's mods a mod manager can install, which doesn't depend
   * on the preset or its sort: always the all-time preset's first page, the very query above while
   * that's open.
   */
  const allMods = useInfiniteQuery({
    ...modSearchQuery(
      api,
      searchFor({
        gameDomainName: searchedGame,
        sort: PRESET_SORTS[COUNTED_PRESET],
        filters: PRESET_FILTERS[COUNTED_PRESET],
        rangeFrom,
      }),
      MODS_PER_PAGE,
    ),
    select: (result) => result.pages[0]?.meta.total_count,
  });

  const pages = mods.isPlaceholderData ? undefined : mods.data?.pages;
  const loaded = useMemo(() => uniqueMods(mods.data?.pages), [mods.data?.pages]);
  const isFirstPageLoading = mods.isFetching && !mods.isFetchingNextPage && !pages;

  return {
    ...views,
    searchKey: JSON.stringify([views.viewId, search.queryKey, restarts]),
    mods: loaded,
    totalCount: mods.data?.pages[0]?.meta.total_count ?? 0,
    allModsTotal: allMods.data ?? 0,
    loading: isFirstPageLoading,
    error: pages ? null : mods.error,
    isLoadingMore: !!pages && mods.isFetching,
    loadMoreError: pages && !mods.isFetching ? mods.error : null,
    hasMore: !!pages && mods.hasNextPage && !mods.isFetching,
    pagesLoaded: pages?.length ?? 0,
    loadMore: () => {
      if (pages && mods.hasNextPage && !mods.isFetching && !mods.isFetchNextPageError) {
        void mods.fetchNextPage();
      }
    },
    retry: () => {
      if (mods.isFetchNextPageError && isRefusedCursor(mods.error)) {
        queryClient.setQueryData(search.queryKey, (data) =>
          data ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) } : data,
        );
        setRestarts((count) => count + 1);
        void mods.refetch();
        return;
      }

      void (mods.isFetchNextPageError ? mods.fetchNextPage() : mods.refetch());
    },
  };
};
