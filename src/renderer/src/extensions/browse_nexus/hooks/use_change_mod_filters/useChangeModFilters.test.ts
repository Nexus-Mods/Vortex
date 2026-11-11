import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { browseModsTracking } from "@/test-utils/browseModsTracking";

import { type IModFilters, NO_FILTERS } from "../../util/mod_views/modViews";
import type { IModSearch } from "../use_mod_search/useModSearch.hook";
import { useChangeModFilters } from "./useChangeModFilters.hook";

/** A Trending search with these filters, over no filters. */
const searchWith = (filters: Partial<IModFilters>) =>
  ({
    trackedView: "trending",
    filters: { ...NO_FILTERS, ...filters },
    setFilters: vi.fn(),
  }) as unknown as IModSearch;

/** The hook over the search, with the events it sends. */
const renderChange = (search: IModSearch) => {
  const tracking = browseModsTracking();
  const { result } = renderHook(() => useChangeModFilters(search), { wrapper: tracking.wrapper });
  return { change: result.current, tracked: tracking.tracked };
};

describe("useChangeModFilters", () => {
  it("sets only the filters that change, and sends each one's event with its source", () => {
    const search = searchWith({ timeRange: "7" });
    const { change, tracked } = renderChange(search);

    change({ timeRange: "all", adult: "include" }, "empty_state");

    expect(search.setFilters).toHaveBeenCalledWith({ timeRange: "all" });
    expect(tracked("browse_mods_time_range_changed").map((event) => event.properties)).toEqual([
      { view: "trending", time_range: "all", previous_time_range: "7", source: "empty_state" },
    ]);
    expect(tracked("browse_mods_adult_filter_changed")).toEqual([]);
  });

  it("does nothing when every filter is already as asked", () => {
    const search = searchWith({ timeRange: "7" });
    const { change, tracked } = renderChange(search);

    change({ timeRange: "7" }, "empty_state");

    expect(search.setFilters).not.toHaveBeenCalled();
    expect(tracked()).toEqual([]);
  });
});
