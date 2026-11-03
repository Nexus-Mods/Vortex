import type {
  ICollectionSearchOptions,
  CollectionSortField,
  SortDirection,
} from "@nexusmods/nexus-api";
import { keepPreviousData, skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GameDomain } from "@vortex/shared";
import { useEffect, useState } from "react";

import {
  collectionSearchKeys,
  collectionSearchQuery,
} from "@/extensions/nexus_integration/queries/collection_search/collectionSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { collectionT } from "../../util/collectionT";
import { useGameDomainName } from "../use_game_domain_name/useGameDomainName.hook";

export interface ISortOption {
  field: CollectionSortField;
  direction: SortDirection;
  label: string;
}

export const SORT_OPTIONS: ISortOption[] = [
  { field: "createdAt", direction: "DESC", label: "Recently Listed" },
  { field: "endorsements", direction: "DESC", label: "Most Endorsed" },
  { field: "recentRating", direction: "DESC", label: "Highest Rated" },
  { field: "downloads", direction: "DESC", label: "Most Downloaded" },
];

/** The sort the search starts on, and the one the tab's total is counted with. */
const DEFAULT_SORT = SORT_OPTIONS[1];

export const COLLECTIONS_PER_PAGE = 20;

interface ICollectionsSearch {
  /** The game whose collections to search; none searches nothing. */
  gameDomainName: GameDomain | undefined;
  /** The sort they're in. */
  sortBy: ISortOption;
  /** What to search for; empty for every collection. */
  search: string;
  /** The page, from 1. */
  page: number;
}

/**
 * The search for a page of a game's listed collections, sorted and optionally searched; none
 * outside a game.
 */
const searchOptions = ({
  gameDomainName,
  sortBy,
  search,
  page,
}: ICollectionsSearch): ICollectionSearchOptions | typeof skipToken => {
  if (!gameDomainName) {
    return skipToken;
  }

  return {
    gameId: gameDomainName,
    count: COLLECTIONS_PER_PAGE,
    offset: (page - 1) * COLLECTIONS_PER_PAGE,
    sort: { field: sortBy.field, direction: sortBy.direction },
    search: search || undefined,
    categoryName: [{ op: "NOT_EQUALS", value: "Wabbajack Mod List" }],
    collectionStatuses: ["listed"],
  };
};

/** Whether the API turned a search down for a term too short to match on. */
const isSearchTooShortError = (error: Error | null) =>
  !!error?.message?.includes("Wildcard value must have 2 or more characters");

/**
 * The active game's listed collections, searched, sorted and a page at a time. Kept above
 * the Browse page's tabs, so the Collections tab's count and its search outlive switching to
 * Mods and back. A search the API turns down as too short is dropped for the full list, and
 * the box says why until what's typed changes. A failed page keeps its search's total, from
 * its cached first page, so the pages stay to move off it.
 */
export const useCollectionSearch = (api: IExtensionApi) => {
  const t = collectionT(api);

  const gameDomainName = useGameDomainName();
  const [sortField, setSortField] = useState<CollectionSortField>(DEFAULT_SORT.field);
  const sortBy = SORT_OPTIONS.find((option) => option.field === sortField) ?? DEFAULT_SORT;
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeSearch, setActiveSearch] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isSearchTooShort, setIsSearchTooShort] = useState(false);
  const queryClient = useQueryClient();

  /** Searches for what's typed from the first page, or clears the search when it's empty. */
  const handleSearch = () => {
    if (searchQuery.length === 1) {
      setIsSearchTooShort(true);
      return;
    }

    setIsSearchTooShort(false);
    setActiveSearch(searchQuery);
    setCurrentPage(1);
  };

  /** Takes what's typed, clearing the last search's validation error. */
  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value);
    setIsSearchTooShort(false);
  };

  /** Sorts by another option, by its field, from the first page. */
  const handleSortChange = (field: CollectionSortField) => {
    setSortField(field);
    setCurrentPage(1);
  };

  /** The page showing; it keeps the last page's results while the next loads. */
  const collections = useQuery({
    ...collectionSearchQuery(
      api,
      searchOptions({ gameDomainName, sortBy, search: activeSearch, page: currentPage }),
    ),
    placeholderData: keepPreviousData,
  });

  /**
   * The tab's total, which doesn't depend on the sort: always the default sort's first page, the
   * very query above until the sort, page or search moves off it.
   */
  const allCollections = useQuery({
    ...collectionSearchQuery(
      api,
      searchOptions({ gameDomainName, sortBy: DEFAULT_SORT, search: "", page: 1 }),
    ),
    select: (result) => result.totalCount,
  });

  const handleRefresh = () =>
    void queryClient.invalidateQueries({ queryKey: collectionSearchKeys.all });

  const isSearchRejected = isSearchTooShortError(collections.error);

  useEffect(() => {
    if (isSearchRejected) {
      setIsSearchTooShort(true);
      setActiveSearch("");
    }
  }, [isSearchRejected]);

  const firstPage = collectionSearchQuery(
    api,
    searchOptions({ gameDomainName, sortBy, search: activeSearch, page: 1 }),
  );
  const pageTotal =
    collections.data?.totalCount ?? queryClient.getQueryData(firstPage.queryKey)?.totalCount;

  return {
    collections: collections.data?.nodes ?? [],
    totalCount: (isSearchRejected ? allCollections.data : pageTotal) ?? 0,
    allCollectionsTotal: allCollections.data ?? 0,
    loading: collections.isFetching || isSearchRejected,
    error: isSearchRejected ? null : collections.error,
    sortBy,
    searchQuery,
    currentPage,
    setCurrentPage,
    searchValidationError: isSearchTooShort ? t("collection:browse.searchTooShort") : "",
    handleSearch,
    handleSearchQueryChange,
    handleSortChange,
    handleRefresh,
  };
};

export type ICollectionSearch = ReturnType<typeof useCollectionSearch>;
