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
    expect(resolveModView("popular", [], {}, true)).toEqual({
      viewId: "popular",
      trackedView: "popular",
      sort: { field: "downloads", direction: "desc" },
      filters: { timeRange: "7", adult: "include" },
      storedFilters: { timeRange: "7", adult: "include" },
      activeFilters: ["timeRange"],
      activeFilterCount: 1,
      canResetSort: false,
      changedFilters: [],
      changedFilterCount: 0,
      isEdited: false,
    });
  });

  it("is the first preset with nothing open, or the open view gone", () => {
    expect(resolveModView(undefined, [], {}, true).viewId).toBe("trending");
    expect(resolveModView("custom-gone", [], {}, true).viewId).toBe("trending");
  });

  it("puts a preset's changes over how it comes, as edited", () => {
    const view = resolveModView(
      "trending",
      [],
      { trending: { sort: { direction: "asc" }, filters: { timeRange: "all" } } },
      true,
    );

    expect(view).toMatchObject({
      sort: { field: "endorsements", direction: "asc" },
      filters: { timeRange: "all", adult: "include" },
      activeFilterCount: 0,
      canResetSort: true,
      changedFilters: ["timeRange"],
      changedFilterCount: 1,
      isEdited: true,
    });
  });

  it("isn't edited by changes back to how a preset comes", () => {
    const view = resolveModView(
      "trending",
      [],
      { trending: { filters: { timeRange: "7" } } },
      true,
    );

    expect(view.isEdited).toBe(false);
  });

  it("is a view of the user's own as saved, never edited, whatever presets have changed", () => {
    const view = resolveModView(
      "custom-1",
      [mine],
      { trending: { filters: { timeRange: "all" } } },
      true,
    );

    expect(view).toMatchObject({
      viewId: "custom-1",
      trackedView: "custom",
      sort: mine.sort,
      filters: { ...mine.filters, adult: "include" },
      isEdited: false,
    });
  });

  it("goes by no filter for one a view was saved without", () => {
    const view = resolveModView("custom-1", [{ ...mine, filters: {} }], {}, true);

    expect(view.filters).toEqual({ timeRange: "all", adult: "include" });
    expect(view.activeFilterCount).toBe(0);
  });

  it("counts an adult content choice as a filter, and a change from how a preset comes", () => {
    const view = resolveModView("trending", [], { trending: { filters: { adult: "only" } } }, true);

    expect(view).toMatchObject({
      filters: { timeRange: "7", adult: "only" },
      activeFilterCount: 2,
      changedFilters: ["adult"],
      isEdited: true,
    });
  });

  it("leaves adult content out for a user who can't see it, which isn't a change", () => {
    const preset = resolveModView(
      "trending",
      [],
      { trending: { filters: { adult: "only" } } },
      false,
    );
    const saved = resolveModView(
      "custom-1",
      [{ ...mine, filters: { adult: "include" } }],
      {},
      false,
    );

    expect(preset).toMatchObject({
      filters: { timeRange: "7", adult: "exclude" },
      storedFilters: { timeRange: "7", adult: "only" },
      activeFilters: ["timeRange"],
      activeFilterCount: 1,
      changedFilters: [],
      isEdited: false,
    });
    expect(saved).toMatchObject({
      filters: { timeRange: "all", adult: "exclude" },
      activeFilterCount: 0,
    });
  });
});
