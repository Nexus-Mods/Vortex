import { describe, expect, it } from "vitest";

import { clearActiveFilters } from "./clearActiveFilters";

describe("clearActiveFilters", () => {
  it("clears a preset's own filter, and nothing locked", () => {
    expect(clearActiveFilters({ activeFilters: ["timeRange"] })).toEqual({ timeRange: "all" });
  });
});
