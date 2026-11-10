import type { EmptyStateKind } from "../../hooks/browse_mods_tracking/browseModsTracker";

/** What the mod list's empty state is about. */
export interface IEmptyStateInput {
  /** Whether it's below the last page's final card, rather than in place of an empty list. */
  isEnd: boolean;
  /** The search text, once Browse has a search box; only spaces counts as none. */
  searchText?: string;
  /** How many filters narrow the mods, locked ones left out. */
  filterCount: number;
}

/** Which empty state to show: the end of the results, or why the list is empty. */
export const emptyStateKind = ({
  isEnd,
  searchText,
  filterCount,
}: IEmptyStateInput): EmptyStateKind => {
  if (isEnd) {
    return "end_of_results";
  }

  const hasSearch = !!searchText?.trim();
  const hasFilters = filterCount > 0;

  if (hasSearch) {
    return hasFilters ? "search_and_filters" : "search_only";
  }

  return hasFilters ? "filters_only" : "nothing_for_game";
};
