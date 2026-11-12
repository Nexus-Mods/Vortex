import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { browseModsTracking } from "@/test-utils/browseModsTracking";

import type { IModSearch } from "../../../hooks/use_mod_search/useModSearch.hook";
import { type IModFilters, NO_FILTERS } from "../../../util/mod_views/modViews";
import { BrowseModsBar } from "./BrowseModsBar";

/**
 * The search the bar shows, with its filters (those not given as no filter has them), which differ
 * from the view's own, and whether the user can see adult content and is logged in. The filters that narrow the
 * mods are worked out as the open view works them out.
 */
const searchWith = (
  filters: Partial<IModFilters>,
  changedFilters: Array<keyof IModFilters> = [],
  canSeeAdult = true,
  isLoggedIn = true,
) => {
  const allFilters = { ...NO_FILTERS, ...filters };
  const activeFilters = (Object.keys(allFilters) as Array<keyof IModFilters>).filter(
    (key) => allFilters[key] !== NO_FILTERS[key] && (canSeeAdult || key !== "adult"),
  );

  return {
    viewId: "trending",
    trackedView: "trending",
    views: [],
    isEdited: false,
    sort: { field: "endorsements", direction: "desc" },
    filters: allFilters,
    activeFilters,
    activeFilterCount: activeFilters.length,
    changedFilters,
    changedFilterCount: changedFilters.length,
    canSeeAdult,
    isLoggedIn,
    totalCount: 172,
    canResetSort: false,
    selectView: vi.fn(),
    resetView: vi.fn(),
    addView: vi.fn(),
    renameView: vi.fn(),
    removeView: vi.fn(),
    setSort: vi.fn(),
    resetSort: vi.fn(),
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
    searchText: "",
    setSearchText: vi.fn(),
  } as unknown as IModSearch;
};

/** Renders the bar over the search, with a tracker whose events it returns. */
const renderBar = (
  search: IModSearch,
  feedback: { hasGiven: boolean; onOpen: () => void } = { hasGiven: false, onOpen: vi.fn() },
) => {
  const tracking = browseModsTracking();
  const view = render(
    <BrowseModsBar
      feedback={feedback}
      panelRefs={{ filters: createRef(), viewOptions: createRef() }}
      search={search}
      viewPicker={null}
    />,
    { wrapper: tracking.wrapper },
  );
  return { ...view, tracked: tracking.tracked };
};

/** The properties of the events of one name. */
const propertiesOf = (tracked: ReturnType<typeof renderBar>["tracked"], eventName: string) =>
  tracked(eventName).map(({ properties }) => properties);

describe("BrowseModsBar", () => {
  it("opens the feedback from its button", async () => {
    const onOpen = vi.fn();
    renderBar(searchWith({}), { hasGiven: false, onOpen });

    await userEvent.click(screen.getByTestId("browse-mods-feedback"));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("turns the feedback button off once it's been given, saying why", async () => {
    const onOpen = vi.fn();
    renderBar(searchWith({}), { hasGiven: true, onOpen });
    const button = screen.getByTestId("browse-mods-feedback");

    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Thanks for your feedback");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("shows the time range that's on, and removes it to all time", async () => {
    const search = searchWith({ timeRange: "7" });
    renderBar(search);

    expect(screen.getByText("7 days")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove time range filter" }));

    expect(search.setFilters).toHaveBeenCalledWith({ timeRange: "all" });
  });

  it("opens the time ranges from the time range that's on, and picks another", async () => {
    const search = searchWith({ timeRange: "7" });
    renderBar(search);

    await userEvent.click(screen.getByRole("button", { name: "7 days" }));

    expect(await screen.findByRole("menuitemradio", { name: "Last 7 days" })).toBeChecked();
    expect(screen.queryByRole("menuitem", { name: "Dates" })).toBeNull();

    await userEvent.click(screen.getByRole("menuitemradio", { name: "Last year" }));

    expect(search.setFilters).toHaveBeenCalledWith({ timeRange: "365" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("shows no time range over all time", () => {
    renderBar(searchWith({ timeRange: "all" }));

    expect(
      screen.queryByRole("button", { name: "Remove time range filter" }),
    ).not.toBeInTheDocument();
  });

  it("offers to reset the filters only once they differ from the view's own", async () => {
    const { unmount } = renderBar(searchWith({ timeRange: "7" }));
    await userEvent.click(screen.getByRole("button", { name: "Filter" }));

    expect(screen.queryByRole("button", { name: /^Reset/ })).toBeNull();

    unmount();
    renderBar(searchWith({ timeRange: "all" }, ["timeRange"]));
    await userEvent.click(screen.getByRole("button", { name: "Filter" }));

    expect(
      await screen.findByRole("button", { name: "Reset 1 filter to default" }),
    ).toBeInTheDocument();
  });

  it("counts changing the time range, and where it was changed from", async () => {
    const search = searchWith({ timeRange: "7" });
    const { tracked } = renderBar(search);

    await userEvent.click(screen.getByRole("button", { name: "7 days" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Last year" }));
    await userEvent.click(screen.getByRole("button", { name: "Filter" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Dates" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Last 24 hours" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove time range filter" }));

    expect(propertiesOf(tracked, "browse_mods_time_range_changed")).toEqual([
      { view: "trending", time_range: "365", previous_time_range: "7", source: "applied_filter" },
      { view: "trending", time_range: "1", previous_time_range: "7", source: "filter_menu" },
      {
        view: "trending",
        time_range: "all",
        previous_time_range: "7",
        source: "applied_filter_clear",
      },
    ]);
  });

  it("shows the adult content choice that's on, and removes it to all content", async () => {
    const search = searchWith({ adult: "only" }, ["adult"]);
    renderBar(search);

    expect(screen.getByRole("button", { name: "Adult content only" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove adult content filter" }));

    expect(search.setFilters).toHaveBeenCalledWith({ adult: "include" });
  });

  it("shows no adult content choice for all content", () => {
    renderBar(searchWith({}));

    expect(screen.queryByRole("button", { name: "Remove adult content filter" })).toBeNull();
  });

  it("shows a user whose preferences hide adult content that none is shown, locked, saying why", async () => {
    renderBar(searchWith({ adult: "exclude" }, [], false));

    expect(screen.getByRole("button", { name: "No adult content" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove adult content filter" })).toBeDisabled();

    await userEvent.hover(screen.getByRole("group", { name: "Adult content" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Adult content is disabled in your preferences",
    );
  });

  it("tells a logged out user to log in to see adult content", async () => {
    renderBar(searchWith({ adult: "exclude" }, [], false, false));

    act(() => screen.getByRole("group", { name: "Adult content" }).focus());

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Log in to view adult content");
  });

  it("counts changing adult content, and where it was changed from", async () => {
    const search = searchWith({ adult: "exclude" }, ["adult"]);
    const { tracked } = renderBar(search);

    await userEvent.click(screen.getByRole("button", { name: "No adult content" }));
    await userEvent.click(
      await screen.findByRole("menuitemradio", { name: "Show only adult content" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Filter" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Adult content" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Reset adult content to default" }),
    );

    expect(propertiesOf(tracked, "browse_mods_adult_filter_changed")).toEqual([
      { view: "trending", adult: "only", previous_adult: "exclude", source: "applied_filter" },
      { view: "trending", adult: "include", previous_adult: "exclude", source: "filter_reset" },
    ]);
  });

  it("counts putting the time range back from Dates as a change from its reset", async () => {
    const search = searchWith({ timeRange: "28" }, ["timeRange"]);
    const { tracked } = renderBar(search);

    await userEvent.click(screen.getByRole("button", { name: "Filter" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Dates" }));
    await userEvent.click(await screen.findByRole("button", { name: "Reset date to default" }));

    expect(search.setFilters).toHaveBeenCalledWith({ timeRange: "7" });
    expect(propertiesOf(tracked, "browse_mods_time_range_changed")).toEqual([
      { view: "trending", time_range: "7", previous_time_range: "28", source: "filter_reset" },
    ]);
  });

  it("counts resetting the filters, and how many differed from the view's", async () => {
    const search = searchWith({ timeRange: "all" }, ["timeRange"]);
    const { tracked } = renderBar(search);

    await userEvent.click(screen.getByRole("button", { name: "Filter" }));
    await userEvent.click(await screen.findByRole("button", { name: "Reset 1 filter to default" }));

    expect(search.resetFilters).toHaveBeenCalled();
    expect(propertiesOf(tracked, "browse_mods_filters_reset")).toEqual([
      { view: "trending", filter_count: 1 },
    ]);
  });

  it("counts turning the sort round, with the sort it ends up as", async () => {
    const search = searchWith({ timeRange: "7" });
    const { tracked } = renderBar(search);

    await userEvent.click(screen.getByRole("button", { name: "View options" }));
    await userEvent.click(await screen.findByRole("button", { name: "Highest first" }));

    expect(search.setSort).toHaveBeenCalledWith({ direction: "asc" });
    expect(propertiesOf(tracked, "browse_mods_sort_changed")).toEqual([
      { view: "trending", sort_field: "endorsements", sort_direction: "asc", is_reset: false },
    ]);
  });

  it("counts the toolbar's clicks as Browse mods'", async () => {
    const { tracked } = renderBar(searchWith({ timeRange: "all" }));

    await userEvent.click(screen.getByRole("button", { name: "Filter" }));

    expect(propertiesOf(tracked, "app_toolbar_action_clicked")).toEqual([
      expect.objectContaining({ action: "filter", toolbar: "browse_mods" }),
    ]);
  });

  it("does nothing, and counts nothing, when the time range or sort picked is the one on", async () => {
    const search = searchWith({ timeRange: "7" });
    const { tracked } = renderBar(search);

    await userEvent.click(screen.getByRole("button", { name: "7 days" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Last 7 days" }));
    await userEvent.click(screen.getByRole("button", { name: "View options" }));
    await userEvent.click(await screen.findByRole("button", { name: /Endorsements/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Endorsements" }));

    expect(search.setFilters).not.toHaveBeenCalled();
    expect(search.setSort).not.toHaveBeenCalled();
    expect(tracked("browse_mods_time_range_changed")).toEqual([]);
    expect(tracked("browse_mods_sort_changed")).toEqual([]);
  });

  it("counts resetting the sort, with the sort it goes back to", async () => {
    const search = {
      ...searchWith({ timeRange: "7" }),
      sort: { field: "downloads", direction: "asc" },
      canResetSort: true,
    } as IModSearch;
    const { tracked } = renderBar(search);

    await userEvent.click(screen.getByRole("button", { name: "View options" }));
    await userEvent.click(await screen.findByText("Reset to default"));

    expect(search.resetSort).toHaveBeenCalled();
    expect(propertiesOf(tracked, "browse_mods_sort_changed")).toEqual([
      { view: "trending", sort_field: "endorsements", sort_direction: "desc", is_reset: true },
    ]);
  });

  it("counts the view options' clicks as Browse mods' too", async () => {
    const { tracked } = renderBar(searchWith({ timeRange: "all" }));

    await userEvent.click(screen.getByRole("button", { name: "View options" }));

    expect(propertiesOf(tracked, "app_toolbar_action_clicked")).toEqual([
      expect.objectContaining({ action: "view-options", toolbar: "browse_mods" }),
    ]);
  });
});
