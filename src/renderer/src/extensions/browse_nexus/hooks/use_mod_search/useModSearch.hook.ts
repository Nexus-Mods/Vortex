import {
  keepPreviousData,
  skipToken,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { V3ApiError } from "@vortex/nexus-api-v3";
import type { GameDomain } from "@vortex/shared";
import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  type ModsSearch,
  type ModSummary,
  modSearchQuery,
} from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import {
  getListingStatus,
  type ListingStatus,
} from "@/ui/components/listing/listing_status/listingStatus";

import { setBrowseModSearchText } from "../../actions/session";
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

/** The text Browse's mods are searched for, as entered; none before any is. */
const modSearchText = (state: IState) => state.session.browse?.modSearchText;

export const MODS_PER_PAGE = 20;

/** The statuses `loadMore` asks for the next page in: loading as it scrolls, or paused. */
const LOAD_MORE_STATUSES: readonly ListingStatus[] = ["idle", "paused"];

/** The API's bounds on a name search: characters other than spaces at least, and in all. */
export const MIN_QUERY_CHARACTERS = 2;
export const MAX_QUERY_LENGTH = 100;

/**
 * The name search the API is sent for the text entered: trimmed and cut to its limit, or none
 * when it has too few characters other than spaces for the API to take.
 */
export const searchQueryFor = (text: string | undefined) => {
  const query = text?.trim().slice(0, MAX_QUERY_LENGTH);

  if (!query || query.replace(/\s/g, "").length < MIN_QUERY_CHARACTERS) {
    return undefined;
  }

  return query;
};

interface IModsSearch {
  /** The game whose mods to search; none searches nothing. */
  gameDomainName: GameDomain | undefined;
  /** How they're sorted. */
  sort: IModSort;
  /** Which of them to show. */
  filters: IModFilters;
  /** When the time range was picked, which it counts back from, in ms. */
  rangeFrom: number;
  /** The text to find in their names; none searches no names. */
  query?: string;
}

/**
 * The search for a game's mods, sorted and filtered, and by name given a query; none outside a
 * game. Only mods that can be installed with a mod manager, as Vortex can't install the rest.
 */
const searchFor = ({
  gameDomainName,
  sort,
  filters,
  rangeFrom,
  query,
}: IModsSearch): ModsSearch | typeof skipToken => {
  if (!gameDomainName) {
    return skipToken;
  }

  return {
    ...(query && { query }),
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
  /** The text entered to search the mods' names for, whatever the view; empty for none. */
  searchText: string;
  /** What's searched for of it: trimmed, and none with too few characters for the API. */
  searchQuery: string | undefined;
  /** Searches the mods' names for this text, in every view until a restart; empty for none. */
  setSearchText: (text: string) => void;
  /** The search the mods are from, by query key and view, and changing as it starts again. */
  searchKey: string;
  /** The mods loaded so far, each only where it first came. */
  mods: ModSummary[];
  /** How many mods the search found; the last search's until the next one's first page comes. */
  totalCount: number;
  /** How many of the game's mods a mod manager can install, over all time, whatever the view. */
  allModsTotal: number;
  /** Where the pages' loading is; asking for them again keeps the mods on screen. */
  status: ListingStatus;
  /** How many pages have loaded. */
  pagesLoaded: number;
  /** Loads the next page, while the list is `idle`, or `paused` until asked. */
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
  const dispatch = useDispatch();
  const searchText = useSelector(modSearchText) ?? "";
  const searchQuery = searchQueryFor(searchText);

  const search = modSearchQuery(
    api,
    searchFor({ gameDomainName: searchedGame, sort, filters, rangeFrom, query: searchQuery }),
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
  const status = getListingStatus({ query: mods, isInfinite: true, itemCount: loaded.length });

  return {
    ...views,
    searchText,
    searchQuery,
    setSearchText: (text: string) => dispatch(setBrowseModSearchText(text)),
    searchKey: JSON.stringify([views.viewId, search.queryKey, restarts]),
    mods: loaded,
    totalCount: mods.data?.pages[0]?.meta.total_count ?? 0,
    allModsTotal: allMods.data ?? 0,
    status,
    pagesLoaded: pages?.length ?? 0,
    loadMore: () => {
      if (LOAD_MORE_STATUSES.includes(status)) {
        void mods.fetchNextPage({ cancelRefetch: false });
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
