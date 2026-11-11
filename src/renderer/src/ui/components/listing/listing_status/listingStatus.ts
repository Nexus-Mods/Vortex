/** Where a list's loading is, which alone decides what `Listing` draws. */
export type ListingStatus =
  /** The items are loading, drawn as tiles in their place. */
  | "loading"
  /** The items failed to load, so there are none to show: just the error. */
  | "failed"
  /** More are loading, drawn as tiles after the items loaded. */
  | "loading_more"
  /** Loading more failed: the items loaded stay, with the error and Try again after them. */
  | "load_more_failed"
  /** There's more to load, asked for as the end of the items nears the view. */
  | "idle"
  /** Everything's loaded, or there's nothing to load: the items, or the empty state. */
  | "done";

/** What a React Query result says about a list's loading. */
export interface IListingQuery {
  /** What's loaded, or the last search's while it's placeholder data. */
  data: unknown;
  /** Why the last fetch failed. */
  error: Error | null;
  /** Whether a fetch is on its way. */
  isFetching: boolean;
  /** Whether `data` is the last search's, shown while this one's loads. */
  isPlaceholderData: boolean;
}

/** What an infinite query's result says, with whether there's another page. */
export interface IInfiniteListingQuery extends IListingQuery {
  /** Whether there's another page to load. */
  hasNextPage: boolean;
}

/** How many items the list has to show, so a failure with none shows the error. */
interface IListingItems {
  /** How many items the list has to show. */
  itemCount: number;
}

/**
 * The query to read, whether it's an infinite one, loading and failing more after its pages, and
 * how many items it has to show.
 */
export type ListingStatusOptions = IListingItems &
  (
    | { query: IListingQuery; isInfinite?: false }
    | { query: IInfiniteListingQuery; isInfinite: true }
  );

/**
 * A query's `Listing` status. A new search still showing the last one's results is `loading`, and
 * a failure with no items to show is `failed`. An infinite query with pages loads and fails more
 * after them; an ordinary one with data is `loading` while it fetches again and `done` if that
 * fails, keeping what it has on screen.
 */
export const getListingStatus = (options: ListingStatusOptions): ListingStatus => {
  const { query, itemCount } = options;
  const hasData = !query.isPlaceholderData && query.data !== undefined;

  if (!hasData) {
    if (query.isFetching) {
      return "loading";
    }

    if (query.error) {
      return "failed";
    }

    return "done";
  }

  if (query.error && !query.isFetching && !itemCount) {
    return "failed";
  }

  if (!options.isInfinite) {
    return query.isFetching ? "loading" : "done";
  }

  if (query.isFetching) {
    return "loading_more";
  }

  if (query.error) {
    return "load_more_failed";
  }

  return options.query.hasNextPage ? "idle" : "done";
};
