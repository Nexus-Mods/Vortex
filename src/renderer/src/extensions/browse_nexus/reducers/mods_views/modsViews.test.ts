import { describe, expect, it } from "vitest";

import {
  addBrowseModsView,
  removeBrowseModsView,
  renameBrowseModsView,
  selectBrowseModsView,
  setBrowseModsViewSearch,
} from "../../actions/modsViews";
import { browseModsViewsReducer, type IBrowseModsView } from "./modsViews";

const reduce = browseModsViewsReducer.reducers;

const mine: IBrowseModsView = {
  id: "custom-1",
  name: "Mine",
  sort: { field: "downloads", direction: "desc" },
  filters: { timeRange: "28" },
};

const withMine = { selected: "custom-1", custom: [mine] };

describe("browseModsViewsReducer", () => {
  it("opens a view by id", () => {
    const state = reduce[selectBrowseModsView.getType()]({ custom: [] }, "popular");

    expect(state.selected).toBe("popular");
  });

  it("adds a view of the user's own and opens it", () => {
    const state = reduce[addBrowseModsView.getType()]({ selected: "trending", custom: [] }, mine);

    expect(state).toEqual(withMine);
  });

  it("renames a view, leaving how it sorts and filters", () => {
    const state = reduce[renameBrowseModsView.getType()](withMine, {
      viewId: "custom-1",
      name: "Theirs",
    });

    expect(state.custom).toEqual([{ ...mine, name: "Theirs" }]);
  });

  it("saves a change of sort or filters into the view, keeping the rest", () => {
    const sorted = reduce[setBrowseModsViewSearch.getType()](withMine, {
      viewId: "custom-1",
      change: { sort: { direction: "asc" } },
    });
    const filtered = reduce[setBrowseModsViewSearch.getType()](sorted, {
      viewId: "custom-1",
      change: { filters: { timeRange: "all" } },
    });

    expect(filtered.custom[0]).toEqual({
      ...mine,
      sort: { field: "downloads", direction: "asc" },
      filters: { timeRange: "all" },
    });
  });

  it("deletes a view, going back to the first preset if it was open", () => {
    const state = reduce[removeBrowseModsView.getType()](withMine, "custom-1");

    expect(state).toEqual({ selected: undefined, custom: [] });
  });

  it("keeps the open view when another is deleted", () => {
    const state = reduce[removeBrowseModsView.getType()](
      { ...withMine, selected: "new" },
      "custom-1",
    );

    expect(state.selected).toBe("new");
  });

  it("leaves the state as it is for a preset's change of sort or filters", () => {
    const state = reduce[setBrowseModsViewSearch.getType()](withMine, {
      viewId: "trending",
      change: { sort: { field: "new" } },
    });

    expect(state).toBe(withMine);
  });

  it("leaves the state as it is when renaming a view that isn't there", () => {
    const state = reduce[renameBrowseModsView.getType()](withMine, {
      viewId: "custom-gone",
      name: "Gone",
    });

    expect(state).toBe(withMine);
  });

  it("leaves the state as it is when the open view is picked again", () => {
    const state = reduce[selectBrowseModsView.getType()](withMine, "custom-1");

    expect(state).toBe(withMine);
  });
});
