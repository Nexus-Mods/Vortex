import { keepPreviousData, skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GameDomain } from "@vortex/shared";
import { useState } from "react";

import {
  type ModsSearchRequest,
  modSearchQuery,
} from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { useGameDomainName } from "../use_game_domain_name/useGameDomainName.hook";

/** The sorts Browse's view presets pick, each newest or most first. */
export type ModPreset = "trending" | "popular" | "new";

/** The preset the search starts on, and the one the tab's total is counted with. */
const DEFAULT_PRESET: ModPreset = "trending";

export const MODS_PER_PAGE = 20;

interface IModsSearch {
  /** The game whose mods to search; none searches nothing. */
  gameDomainName: GameDomain | undefined;
  /** The preset they're sorted by. */
  preset: ModPreset;
  /** The page, from 1. */
  page: number;
}

/** The search for a page of a game's mods, sorted by a preset; none outside a game. */
const searchFor = ({
  gameDomainName,
  preset,
  page,
}: IModsSearch): ModsSearchRequest | typeof skipToken => {
  if (!gameDomainName) {
    return skipToken;
  }

  return {
    filters: { games: [gameDomainName] },
    sort: { field: preset, direction: "desc" },
    pagination: { page, page_size: MODS_PER_PAGE },
  };
};

interface IModSearchOptions {
  /** Whether to search at all; off, it asks for nothing. */
  isEnabled: boolean;
}

/**
 * The active game's mods, sorted by a preset and a page at a time. Kept above the Browse
 * page's tabs, so the Mods tab's count, preset and page outlive switching to Collections and
 * back. Asks for nothing while it isn't enabled. A failed page keeps its preset's total, from
 * its cached first page, so the pages stay to move off it.
 */
export const useModSearch = (api: IExtensionApi, { isEnabled }: IModSearchOptions) => {
  const gameDomainName = useGameDomainName();
  const searchedGame = isEnabled ? gameDomainName : undefined;
  const [preset, setPresetState] = useState<ModPreset>(DEFAULT_PRESET);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const queryClient = useQueryClient();

  /** Sorts by another preset, from the first page. */
  const setPreset = (next: ModPreset) => {
    setPresetState(next);
    setCurrentPage(1);
  };

  /** The page showing; it keeps the last page's results while the next loads. */
  const mods = useQuery({
    ...modSearchQuery(api, searchFor({ gameDomainName: searchedGame, preset, page: currentPage })),
    placeholderData: keepPreviousData,
  });

  /**
   * The tab's total, which doesn't depend on the preset: always the default preset's first
   * page, the very query above until the preset or page moves off it.
   */
  const allMods = useQuery({
    ...modSearchQuery(
      api,
      searchFor({ gameDomainName: searchedGame, preset: DEFAULT_PRESET, page: 1 }),
    ),
    select: (result) => result.meta.total_count,
  });

  const firstPage = modSearchQuery(
    api,
    searchFor({ gameDomainName: searchedGame, preset, page: 1 }),
  );
  const pageTotal =
    mods.data?.meta.total_count ?? queryClient.getQueryData(firstPage.queryKey)?.meta.total_count;

  return {
    mods: mods.data?.mods ?? [],
    totalCount: pageTotal ?? 0,
    allModsTotal: allMods.data ?? 0,
    loading: mods.isFetching,
    error: mods.error,
    preset,
    setPreset,
    currentPage,
    setCurrentPage,
  };
};

export type IModSearch = ReturnType<typeof useModSearch>;
