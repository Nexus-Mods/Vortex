import { keepPreviousData, skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GameDomain } from "@vortex/shared";
import { useState } from "react";

import {
  type ModsSearchRequest,
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

/** The last page the search will return; it refuses any after. */
export const MAX_PAGES = 100;

interface IModsSearch {
  /** The game whose mods to search; none searches nothing. */
  gameDomainName: GameDomain | undefined;
  /** How they're sorted. */
  sort: IModSort;
  /** Which of them to show. */
  filters: IModFilters;
  /** The page, from 1. */
  page: number;
  /** When the time range was picked, which it counts back from, in ms. */
  rangeFrom: number;
}

/** The search for a page of a game's mods, sorted and filtered; none outside a game. */
const searchFor = ({
  gameDomainName,
  sort,
  filters,
  page,
  rangeFrom,
}: IModsSearch): ModsSearchRequest | typeof skipToken => {
  if (!gameDomainName) {
    return skipToken;
  }

  return {
    filters: {
      games: [gameDomainName],
      ...filtersToSearch(filters, { sortField: sort.field, rangeFrom }),
    },
    sort: { field: sort.field, direction: sort.direction },
    pagination: { type: "page", page, page_size: MODS_PER_PAGE },
  };
};

interface IModSearchOptions {
  /** Whether to search at all; off, it asks for nothing. */
  isEnabled: boolean;
}

/**
 * The active game's mods by the open view, from `useModViews`, a page at a time; any change to the
 * view or its search starts again from the first page, and a failed page keeps its first's total.
 */
export const useModSearch = (api: IExtensionApi, { isEnabled }: IModSearchOptions) => {
  const gameDomainName = useGameDomainName();
  const searchedGame = isEnabled ? gameDomainName : undefined;
  const views = useModViews();
  const { sort, filters, rangeFrom } = views;
  const queryClient = useQueryClient();
  const searchKey = JSON.stringify([views.viewId, sort, filters, rangeFrom]);
  const [paging, setPaging] = useState({ searchKey, page: 1 });
  const currentPage = paging.searchKey === searchKey ? paging.page : 1;

  /** The page showing; it keeps the last page's results while the next loads. */
  const mods = useQuery({
    ...modSearchQuery(
      api,
      searchFor({ gameDomainName: searchedGame, sort, filters, page: currentPage, rangeFrom }),
    ),
    placeholderData: keepPreviousData,
  });

  /**
   * The tab's total, every one of the game's mods, which doesn't depend on the preset or its
   * sort: always the all-time preset's first page as it comes, the very query above while
   * that's the page showing.
   */
  const allMods = useQuery({
    ...modSearchQuery(
      api,
      searchFor({
        gameDomainName: searchedGame,
        sort: PRESET_SORTS[COUNTED_PRESET],
        filters: PRESET_FILTERS[COUNTED_PRESET],
        page: 1,
        rangeFrom,
      }),
    ),
    select: (result) => result.meta.total_count,
  });

  const firstPage = modSearchQuery(
    api,
    searchFor({ gameDomainName: searchedGame, sort, filters, page: 1, rangeFrom }),
  );
  const pageTotal =
    mods.data?.meta.total_count ?? queryClient.getQueryData(firstPage.queryKey)?.meta.total_count;

  return {
    ...views,
    mods: mods.data?.mods ?? [],
    totalCount: pageTotal ?? 0,
    allModsTotal: allMods.data ?? 0,
    loading: mods.isFetching,
    error: mods.error,
    retry: () => void mods.refetch(),
    currentPage,
    setCurrentPage: (page: number) => setPaging({ searchKey, page }),
  };
};

export type IModSearch = ReturnType<typeof useModSearch>;
