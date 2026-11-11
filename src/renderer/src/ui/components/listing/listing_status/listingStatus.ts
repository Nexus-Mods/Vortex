/**
 * Where a list's loading is: its first items loading or failed, more of them loading or failed,
 * more left to load, or all of it loaded.
 */
export type ListingStatus =
  | "loading"
  | "failed"
  | "loading_more"
  | "load_more_failed"
  | "idle"
  | "done";

/** What a React Query result says about a list's loading; an infinite query has `hasNextPage`. */
export interface IListingQuery {
  /** What's loaded, or the last search's while it's placeholder data. */
  data: unknown;
  /** Why the last fetch failed. */
  error: Error | null;
  /** Whether a fetch is on its way. */
  isFetching: boolean;
  /** Whether `data` is the last search's, shown while this one's loads. */
  isPlaceholderData: boolean;
  /** Whether there's another page; an infinite query's only. */
  hasNextPage?: boolean;
}

/**
 * A query's `Listing` status. A new search still showing the last one's results is `loading`. An
 * infinite query with pages loads and fails more after them; an ordinary one with data is
 * `loading` while it fetches again and `done` if that fails, keeping what it has on screen.
 */
export const getListingStatus = (query: IListingQuery): ListingStatus => {
  const isInfinite = query.hasNextPage !== undefined;
  const hasData = !query.isPlaceholderData && query.data !== undefined;

  if (!hasData) {
    if (query.isFetching) {
      return "loading";
    }

    return query.error ? "failed" : "done";
  }

  if (!isInfinite) {
    return query.isFetching ? "loading" : "done";
  }

  if (query.isFetching) {
    return "loading_more";
  }

  if (query.error) {
    return "load_more_failed";
  }

  return query.hasNextPage ? "idle" : "done";
};
