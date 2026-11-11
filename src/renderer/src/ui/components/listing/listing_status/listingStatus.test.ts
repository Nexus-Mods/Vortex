import { describe, expect, it } from "vitest";

import { getListingStatus, type IInfiniteListingQuery, type IListingQuery } from "./listingStatus";

/** An ordinary query's status, settled with no data, as these states change it. */
const queryStatus = (state: Partial<IListingQuery> = {}) =>
  getListingStatus({
    query: { data: undefined, error: null, isFetching: false, isPlaceholderData: false, ...state },
  });

/** An infinite query's status, with a page and no more, as these states change it. */
const infiniteStatus = (state: Partial<IInfiniteListingQuery> = {}) =>
  getListingStatus({
    isInfinite: true,
    query: {
      data: { pages: [[]] },
      error: null,
      isFetching: false,
      isPlaceholderData: false,
      hasNextPage: false,
      ...state,
    },
  });

describe("getListingStatus", () => {
  describe("with nothing loaded", () => {
    it("is loading while it fetches", () => {
      expect(queryStatus({ isFetching: true })).toBe("loading");
    });

    it("is failed once a fetch fails", () => {
      expect(queryStatus({ error: new Error("Network down") })).toBe("failed");
    });

    it("is loading while it fetches again after failing", () => {
      expect(queryStatus({ error: new Error("Network down"), isFetching: true })).toBe("loading");
    });

    it("is done when it asks for nothing", () => {
      expect(queryStatus()).toBe("done");
    });

    it("is loading while it shows the last search's results", () => {
      expect(infiniteStatus({ isPlaceholderData: true, isFetching: true, hasNextPage: true })).toBe(
        "loading",
      );
    });
  });

  describe("an ordinary query with data", () => {
    it("is done", () => {
      expect(queryStatus({ data: [] })).toBe("done");
    });

    it("is loading while it fetches again", () => {
      expect(queryStatus({ data: [], isFetching: true })).toBe("loading");
    });

    it("is done, keeping its data, when fetching again fails", () => {
      expect(queryStatus({ data: [], error: new Error("Network down") })).toBe("done");
    });
  });

  describe("an infinite query with pages", () => {
    it("is idle while there are more pages", () => {
      expect(infiniteStatus({ hasNextPage: true })).toBe("idle");
    });

    it("is done after the last page", () => {
      expect(infiniteStatus()).toBe("done");
    });

    it("is loading more while it fetches, the next page or the first again", () => {
      expect(infiniteStatus({ hasNextPage: true, isFetching: true })).toBe("loading_more");
    });

    it("is load more failed when a fetch fails", () => {
      expect(infiniteStatus({ hasNextPage: true, error: new Error("Network down") })).toBe(
        "load_more_failed",
      );
    });
  });
});
