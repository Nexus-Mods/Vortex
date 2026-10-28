import { keepPreviousData, skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GameDomain } from "@vortex/shared";
import { useState } from "react";

import {
  type ModsSearchRequest,
  modSearchQuery,
} from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { useGameDomainName } from "../use_game_domain_name/useGameDomainName.hook";

/** Browse's view presets, each with a sort of its own. */
export type ModPreset = "trending" | "popular" | "new";

/** What the mods can be sorted by. */
export type ModSortField = ModsSearchRequest["sort"]["field"];

/** Which way round they're sorted. */
export type ModSortDirection = ModsSearchRequest["sort"]["direction"];

/** How far back the mods go, in days or all time. */
export type ModTimeRange = NonNullable<ModsSearchRequest["filters"]["time_range"]>;

/** How a preset sorts the mods. */
export interface IModSort {
  /** What they're sorted by. */
  field: ModSortField;
  /** Which way round. */
  direction: ModSortDirection;
  /** How far back they go: created within it, or updated within it for `updated`. */
  timeRange: ModTimeRange;
}

/** Each preset's sort as it comes, which resetting goes back to. */
export const PRESET_SORTS: Record<ModPreset, IModSort> = {
  trending: { field: "trending", direction: "desc", timeRange: "7" },
  popular: { field: "popular", direction: "desc", timeRange: "7" },
  new: { field: "new", direction: "desc", timeRange: "all" },
};

/** The preset the search starts on. */
const DEFAULT_PRESET: ModPreset = "trending";

/**
 * The preset the tab's total is counted with, as it comes: the one over all time, as trending
 * and popular cover only the last week.
 */
const COUNTED_PRESET: ModPreset = "new";

export const MODS_PER_PAGE = 20;

/** The last page the search will return; it refuses any after. */
export const MAX_PAGES = 100;

interface IModsSearch {
  /** The game whose mods to search; none searches nothing. */
  gameDomainName: GameDomain | undefined;
  /** How they're sorted. */
  sort: IModSort;
  /** The page, from 1. */
  page: number;
}

/** The search for a page of a game's mods, sorted; none outside a game. */
const searchFor = ({
  gameDomainName,
  sort,
  page,
}: IModsSearch): ModsSearchRequest | typeof skipToken => {
  if (!gameDomainName) {
    return skipToken;
  }

  return {
    filters: { games: [gameDomainName], time_range: sort.timeRange },
    sort: { field: sort.field, direction: sort.direction },
    pagination: { page, page_size: MODS_PER_PAGE },
  };
};

/** Whether two sorts sort the same way. */
const isSameSort = (lhs: IModSort, rhs: IModSort) =>
  lhs.field === rhs.field && lhs.direction === rhs.direction && lhs.timeRange === rhs.timeRange;

interface IModSearchOptions {
  /** Whether to search at all; off, it asks for nothing. */
  isEnabled: boolean;
}

/**
 * The active game's mods, sorted by a preset and a page at a time. Each preset keeps its own
 * sort, which changing it changes and resetting returns to how it came, as the mods table's
 * views keep their options. Kept above the Browse page's tabs, so the Mods tab's count, presets
 * and page outlive switching to Collections and back. Asks for nothing while it isn't enabled.
 * A failed page keeps its sort's total, from its cached first page, so the pages stay to move
 * off it.
 */
export const useModSearch = (api: IExtensionApi, { isEnabled }: IModSearchOptions) => {
  const gameDomainName = useGameDomainName();
  const searchedGame = isEnabled ? gameDomainName : undefined;
  const [preset, setPreset] = useState<ModPreset>(DEFAULT_PRESET);
  const [sorts, setSorts] = useState(PRESET_SORTS);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const queryClient = useQueryClient();
  const sort = sorts[preset];

  /** Sorts by another preset, from the first page. */
  const selectPreset = (next: ModPreset) => {
    setPreset(next);
    setCurrentPage(1);
  };

  /** Changes how the open preset sorts, from the first page. */
  const setSort = (change: Partial<IModSort>) => {
    setSorts((previous) => ({ ...previous, [preset]: { ...previous[preset], ...change } }));
    setCurrentPage(1);
  };

  /** Puts the open preset's sort back as it came, from the first page. */
  const resetSort = () => setSort(PRESET_SORTS[preset]);

  /** The page showing; it keeps the last page's results while the next loads. */
  const mods = useQuery({
    ...modSearchQuery(api, searchFor({ gameDomainName: searchedGame, sort, page: currentPage })),
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
      searchFor({ gameDomainName: searchedGame, sort: PRESET_SORTS[COUNTED_PRESET], page: 1 }),
    ),
    select: (result) => result.meta.total_count,
  });

  const firstPage = modSearchQuery(api, searchFor({ gameDomainName: searchedGame, sort, page: 1 }));
  const pageTotal =
    mods.data?.meta.total_count ?? queryClient.getQueryData(firstPage.queryKey)?.meta.total_count;

  return {
    mods: mods.data?.mods ?? [],
    totalCount: pageTotal ?? 0,
    allModsTotal: allMods.data ?? 0,
    loading: mods.isFetching,
    error: mods.error,
    retry: () => void mods.refetch(),
    preset,
    selectPreset,
    sort,
    setSort,
    canResetSort: !isSameSort(sort, PRESET_SORTS[preset]),
    resetSort,
    currentPage,
    setCurrentPage,
  };
};

export type IModSearch = ReturnType<typeof useModSearch>;
