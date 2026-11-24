import { describe, expect, it } from "vitest";

import {
  getListingStatus,
  type IInfiniteListingQuery,
  type IListingQuery,
  PAGES_BEFORE_PAUSE,
} from "./listingStatus";

const NETWORK_DOWN = new Error("Network down");

/** An ordinary query's status, settled with no data and no items, as these change it. */
const queryStatus = (state: Partial<IListingQuery> = {}, itemCount = 0) =>
  getListingStatus({
    itemCount,
    query: { data: undefined, error: null, isFetching: false, isPlaceholderData: false, ...state },
  });

/** An infinite query's status, with a page of 20 items and no more, as these change it. */
const infiniteStatus = (state: Partial<IInfiniteListingQuery> = {}, itemCount = 20) =>
  getListingStatus({
    isInfinite: true,
    itemCount,
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
      expect(queryStatus({ error: NETWORK_DOWN })).toBe("failed");
    });

    it("is loading while it fetches again after failing", () => {
      expect(queryStatus({ error: NETWORK_DOWN, isFetching: true })).toBe("loading");
    });

    it("is done when it asks for nothing", () => {
      expect(queryStatus()).toBe("done");
    });
  });

  describe("showing the last search's results", () => {
    it("is loading for an infinite query", () => {
      expect(infiniteStatus({ isPlaceholderData: true, isFetching: true, hasNextPage: true })).toBe(
        "loading",
      );
    });

    it("is loading for an ordinary query", () => {
      expect(queryStatus({ data: [], isPlaceholderData: true, isFetching: true }, 12)).toBe(
        "loading",
      );
    });

    it("is done with nothing fetching", () => {
      expect(queryStatus({ data: [], isPlaceholderData: true }, 12)).toBe("done");
    });
  });

  describe("an ordinary query with data", () => {
    it("is done", () => {
      expect(queryStatus({ data: [] }, 12)).toBe("done");
    });

    it("is loading while it fetches again", () => {
      expect(queryStatus({ data: [], isFetching: true }, 12)).toBe("loading");
    });

    it("is done, keeping its items, when fetching again fails", () => {
      expect(queryStatus({ data: [], error: NETWORK_DOWN }, 12)).toBe("done");
    });

    it("is failed when fetching again fails with no items to keep", () => {
      expect(queryStatus({ data: [], error: NETWORK_DOWN }, 0)).toBe("failed");
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

    it("is loading more while it retries a page that failed", () => {
      expect(infiniteStatus({ hasNextPage: true, error: NETWORK_DOWN, isFetching: true })).toBe(
        "loading_more",
      );
    });

    it("is load more failed when a fetch fails", () => {
      expect(infiniteStatus({ hasNextPage: true, error: NETWORK_DOWN })).toBe("load_more_failed");
    });

    it.each([1, 2, 3])("pauses after %i times the pages it loads before pausing", (times) => {
      const pages = Array(PAGES_BEFORE_PAUSE * times).fill([]);
      expect(infiniteStatus({ data: { pages }, hasNextPage: true })).toBe("paused");
    });

    it.each([-1, 1])("is idle %i page from a pause", (offset) => {
      const pages = Array(PAGES_BEFORE_PAUSE + offset).fill([]);
      expect(infiniteStatus({ data: { pages }, hasNextPage: true })).toBe("idle");
    });

    it("is done, not paused, when its last page lands on a pause", () => {
      const pages = Array(PAGES_BEFORE_PAUSE).fill([]);
      expect(infiniteStatus({ data: { pages } })).toBe("done");
    });

    it("is failed when a fetch fails with no items to show", () => {
      expect(infiniteStatus({ hasNextPage: true, error: NETWORK_DOWN }, 0)).toBe("failed");
    });
  });
});
