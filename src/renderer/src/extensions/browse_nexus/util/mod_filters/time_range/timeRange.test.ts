import { describe, expect, it } from "vitest";

import { timeRangeSearch } from "./timeRange";

const NOW = Date.parse("2026-11-03T14:35:00Z");

/** The start of a range of so many days back from `NOW`. */
const daysBack = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

describe("timeRangeSearch", () => {
  it("filters by when mods were created, exactly a range of days back", () => {
    expect(timeRangeSearch("1", "endorsements", NOW)).toEqual({
      created_at: { gte: daysBack(1) },
    });
  });

  it("filters by when they were updated for the Date updated sort", () => {
    expect(timeRangeSearch("28", "updated", NOW)).toEqual({ updated_at: { gte: daysBack(28) } });
  });

  it("doesn't filter for all time", () => {
    expect(timeRangeSearch("all", "updated", NOW)).toEqual({});
  });
});
