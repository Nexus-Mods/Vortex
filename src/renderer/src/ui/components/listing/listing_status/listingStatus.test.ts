import { describe, expect, it } from "vitest";

import { getListingStatus, type IListingQuery } from "./listingStatus";

/** An ordinary query, settled with no data, as these states change it. */
const query = (state: Partial<IListingQuery> = {}): IListingQuery => ({
  data: undefined,
  error: null,
  isFetching: false,
  isPlaceholderData: false,
  ...state,
});

/** An infinite query with a page, and no more, as these states change it. */
const infinite = (state: Partial<IListingQuery> = {}) =>
  query({ data: { pages: [[]] }, hasNextPage: false, ...state });

describe("getListingStatus", () => {
  describe("with nothing loaded", () => {
    it("is loading while it fetches", () => {
      expect(getListingStatus(query({ isFetching: true }))).toBe("loading");
    });

    it("is failed once a fetch fails", () => {
      expect(getListingStatus(query({ error: new Error("Network down") }))).toBe("failed");
    });

    it("is loading while it fetches again after failing", () => {
      expect(getListingStatus(query({ error: new Error("Network down"), isFetching: true }))).toBe(
        "loading",
      );
    });

    it("is done when it asks for nothing", () => {
      expect(getListingStatus(query())).toBe("done");
    });

    it("is loading while it shows the last search's results", () => {
      expect(
        getListingStatus(
          infinite({ isPlaceholderData: true, isFetching: true, hasNextPage: true }),
        ),
      ).toBe("loading");
    });
  });

  describe("an ordinary query with data", () => {
    it("is done", () => {
      expect(getListingStatus(query({ data: [] }))).toBe("done");
    });

    it("is loading while it fetches again", () => {
      expect(getListingStatus(query({ data: [], isFetching: true }))).toBe("loading");
    });

    it("is done, keeping its data, when fetching again fails", () => {
      expect(getListingStatus(query({ data: [], error: new Error("Network down") }))).toBe("done");
    });
  });

  describe("an infinite query with pages", () => {
    it("is idle while there are more pages", () => {
      expect(getListingStatus(infinite({ hasNextPage: true }))).toBe("idle");
    });

    it("is done after the last page", () => {
      expect(getListingStatus(infinite())).toBe("done");
    });

    it("is loading more while it fetches, the next page or the first again", () => {
      expect(getListingStatus(infinite({ hasNextPage: true, isFetching: true }))).toBe(
        "loading_more",
      );
    });

    it("is load more failed when a fetch fails", () => {
      expect(
        getListingStatus(infinite({ hasNextPage: true, error: new Error("Network down") })),
      ).toBe("load_more_failed");
    });
  });
});
