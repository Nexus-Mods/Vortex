import { keepPreviousData, skipToken, useInfiniteQuery } from "@tanstack/react-query";
import type { GameDomain } from "@vortex/shared";
import { useMemo } from "react";

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

/** The search for a game's mods, sorted and filtered; none outside a game. */
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

interface IModSearchOptions {
  /** Whether to search at all; off, it asks for nothing. */
  isEnabled: boolean;
}

/**
 * The active game's mods by the open view, from `useModViews`, a page more at a time as
 * `loadMore` asks; any change to the view or its search starts again from the first page.
 */
export const useModSearch = (api: IExtensionApi, { isEnabled }: IModSearchOptions) => {
  const gameDomainName = useGameDomainName();
  const searchedGame = isEnabled ? gameDomainName : undefined;
  const views = useModViews();
  const { sort, filters, rangeFrom } = views;

  const search = modSearchQuery(
    api,
    searchFor({ gameDomainName: searchedGame, sort, filters, rangeFrom }),
    MODS_PER_PAGE,
  );

  /** The pages loaded; it keeps the last search's while another's first page loads. */
  const mods = useInfiniteQuery({ ...search, placeholderData: keepPreviousData });

  /**
   * The tab's total, every one of the game's mods, which doesn't depend on the preset or its
   * sort: always the all-time preset's first page, the very query above while that's open.
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
  const isFirstPageLoading = mods.isFetching && !mods.isFetchingNextPage;

  return {
    ...views,
    /**
     * Which search the mods are from: its query's key, and the view, as two views can make the
     * same search. It changes whenever the game, the view or its search does.
     */
    searchKey: JSON.stringify([views.viewId, search.queryKey]),
    mods: loaded,
    totalCount: mods.data?.pages[0]?.meta.total_count ?? 0,
    allModsTotal: allMods.data ?? 0,
    loading: isFirstPageLoading,
    error: mods.isFetchNextPageError ? null : mods.error,
    /** Whether a page after the first is loading. */
    isLoadingMore: mods.isFetchingNextPage,
    /** Why the last page asked for after the first failed, until it's asked for again. */
    loadMoreError: mods.isFetchNextPageError && !mods.isFetchingNextPage ? mods.error : null,
    /** Whether there are pages left to load. */
    hasMore: !!pages && mods.hasNextPage,
    /** How many pages of this search have loaded. */
    pagesLoaded: pages?.length ?? 0,
    /** Loads the next page, unless one is loading, it's failed, or there are none left. */
    loadMore: () => {
      if (pages && mods.hasNextPage && !mods.isFetching && !mods.isFetchNextPageError) {
        void mods.fetchNextPage();
      }
    },
    /** Asks again for whichever page failed: the next one, or the first. */
    retry: () => void (mods.isFetchNextPageError ? mods.fetchNextPage() : mods.refetch()),
  };
};

export type IModSearch = ReturnType<typeof useModSearch>;
