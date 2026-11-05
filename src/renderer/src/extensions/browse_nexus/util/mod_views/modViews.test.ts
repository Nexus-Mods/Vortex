import { describe, expect, it } from "vitest";

import type { IBrowseModsView } from "../../reducers/mods_views/modsViews";
import { resolveModView } from "./modViews";

const mine: IBrowseModsView = {
  id: "custom-1",
  name: "Mine",
  sort: { field: "downloads", direction: "asc" },
  filters: { timeRange: "28" },
};

describe("resolveModView", () => {
  it("is a preset as it comes, unedited", () => {
    expect(resolveModView("popular", [], {})).toEqual({
      viewId: "popular",
      trackedView: "popular",
      sort: { field: "downloads", direction: "desc" },
      filters: { timeRange: "7" },
      activeFilterCount: 1,
      canResetSort: false,
      changedFilterCount: 0,
      isEdited: false,
    });
  });

  it("is the first preset with nothing open, or the open view gone", () => {
    expect(resolveModView(undefined, [], {}).viewId).toBe("trending");
    expect(resolveModView("custom-gone", [], {}).viewId).toBe("trending");
  });

  it("puts a preset's changes over how it comes, as edited", () => {
    const view = resolveModView("trending", [], {
      trending: { sort: { direction: "asc" }, filters: { timeRange: "all" } },
    });

    expect(view).toMatchObject({
      sort: { field: "endorsements", direction: "asc" },
      filters: { timeRange: "all" },
      activeFilterCount: 0,
      canResetSort: true,
      changedFilterCount: 1,
      isEdited: true,
    });
  });

  it("isn't edited by changes back to how a preset comes", () => {
    const view = resolveModView("trending", [], { trending: { filters: { timeRange: "7" } } });

    expect(view.isEdited).toBe(false);
  });

  it("is a view of the user's own as saved, never edited, whatever presets have changed", () => {
    const view = resolveModView("custom-1", [mine], {
      trending: { filters: { timeRange: "all" } },
    });

    expect(view).toMatchObject({
      viewId: "custom-1",
      trackedView: "custom",
      sort: mine.sort,
      filters: mine.filters,
      isEdited: false,
    });
  });

  it("goes by no filter for one a view was saved without", () => {
    const view = resolveModView("custom-1", [{ ...mine, filters: {} }], {});

    expect(view.filters).toEqual({ timeRange: "all" });
    expect(view.activeFilterCount).toBe(0);
  });
});
