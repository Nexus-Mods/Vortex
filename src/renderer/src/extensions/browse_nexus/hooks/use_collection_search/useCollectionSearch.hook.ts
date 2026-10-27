import type {
  ICollection,
  ICollectionSearchOptions,
  CollectionSortField,
  SortDirection,
} from "@nexusmods/nexus-api";
import { queryOptions, skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GameDomain } from "@vortex/shared";
import { useEffect, useState } from "react";

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

/** The keys of the collections queries. */
const collectionKeys = {
  /** All of a game's collection queries, which refreshing invalidates. */
  all: (gameDomainName: GameDomain | undefined) =>
    ["nexus", "collections", gameDomainName] as const,
  /** One page of them, sorted and optionally searched. */
  page: (
    gameDomainName: GameDomain | undefined,
    filters: { sort: CollectionSortField; direction: SortDirection; search: string; page: number },
  ) => [...collectionKeys.all(gameDomainName), filters] as const,
};

/**
 * A page of a game's listed collections, sorted and optionally searched. Its nodes are typed
 * whole, as the search's GraphQL query selects every field a tile reads.
 */
const collectionsQuery = (
  api: IExtensionApi,
  gameDomainName: GameDomain | undefined,
  sortBy: ISortOption,
  search: string,
  page: number,
) =>
  queryOptions({
    queryKey: collectionKeys.page(gameDomainName, {
      sort: sortBy.field,
      direction: sortBy.direction,
      search,
      page,
    }),
    queryFn: gameDomainName
      ? async (): Promise<{ nodes: ICollection[]; totalCount: number }> => {
          const options: ICollectionSearchOptions = {
            gameId: gameDomainName,
            count: COLLECTIONS_PER_PAGE,
            offset: (page - 1) * COLLECTIONS_PER_PAGE,
            sort: { field: sortBy.field, direction: sortBy.direction },
            search: search || undefined,
            categoryName: [{ op: "NOT_EQUALS", value: "Wabbajack Mod List" }],
            collectionStatuses: ["listed"],
          };

          const result = await api.ext.nexusSearchCollections(options);
          return {
            nodes: (result.nodes ?? []) as ICollection[],
            totalCount: result.totalCount ?? 0,
          };
        }
      : skipToken,
  });

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

  /** The page showing; it keeps the last page's results while the next loads, in one game. */
  const collections = useQuery({
    ...collectionsQuery(api, gameDomainName, sortBy, activeSearch, currentPage),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === gameDomainName ? previous : undefined,
  });

  /**
   * The tab's total, which doesn't depend on the sort: always the default sort's first page, the
   * very query above until the sort, page or search moves off it.
   */
  const allCollections = useQuery({
    ...collectionsQuery(api, gameDomainName, DEFAULT_SORT, "", 1),
    select: (result) => result.totalCount,
  });

  const handleRefresh = () =>
    void queryClient.invalidateQueries({ queryKey: collectionKeys.all(gameDomainName) });

  const isSearchRejected = isSearchTooShortError(collections.error);

  useEffect(() => {
    if (isSearchRejected) {
      setIsSearchTooShort(true);
      setActiveSearch("");
    }
  }, [isSearchRejected]);

  const firstPage = collectionsQuery(api, gameDomainName, sortBy, activeSearch, 1);
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
