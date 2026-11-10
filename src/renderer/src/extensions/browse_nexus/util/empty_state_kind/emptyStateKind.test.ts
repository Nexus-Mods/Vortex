import { describe, expect, it } from "vitest";

import { emptyStateKind } from "./emptyStateKind";

describe("emptyStateKind", () => {
  it("ends the results whatever the search and filters", () => {
    expect(emptyStateKind({ isEnd: true, searchText: "SkyUI", filterCount: 2 })).toBe(
      "end_of_results",
    );
  });

  it("is search only with a search and no filters", () => {
    expect(emptyStateKind({ isEnd: false, searchText: "SkyUI", filterCount: 0 })).toBe(
      "search_only",
    );
  });

  it("is search and filters with both", () => {
    expect(emptyStateKind({ isEnd: false, searchText: "SkyUI", filterCount: 1 })).toBe(
      "search_and_filters",
    );
  });

  it("is filters only with filters and no search", () => {
    expect(emptyStateKind({ isEnd: false, filterCount: 1 })).toBe("filters_only");
  });

  it("is nothing for the game with neither", () => {
    expect(emptyStateKind({ isEnd: false, filterCount: 0 })).toBe("nothing_for_game");
  });

  it("counts a search of only spaces as none", () => {
    expect(emptyStateKind({ isEnd: false, searchText: "  ", filterCount: 0 })).toBe(
      "nothing_for_game",
    );
  });
});
