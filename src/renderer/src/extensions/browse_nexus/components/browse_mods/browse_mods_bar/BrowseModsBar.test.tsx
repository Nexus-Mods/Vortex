import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { browseModsTracking } from "@/test-utils/browseModsTracking";

import type { IModFilters, IModSearch } from "../../../hooks/use_mod_search/useModSearch.hook";
import { BrowseModsBar } from "./BrowseModsBar";

/** The search the bar shows, with its filters and how many of them are on. */
const searchWith = (filters: IModFilters, activeFilterCount: number, changedFilterCount = 0) =>
  ({
    preset: "trending",
    sort: { field: "endorsements", direction: "desc" },
    filters,
    activeFilterCount,
    changedFilterCount,
    totalCount: 172,
    canResetSort: false,
    selectPreset: vi.fn(),
    setSort: vi.fn(),
    resetSort: vi.fn(),
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
  }) as unknown as IModSearch;

/** Renders the bar over the search, with a tracker whose events it returns. */
const renderBar = (search: IModSearch) => {
  const tracking = browseModsTracking();
  const view = render(<BrowseModsBar search={search} />, { wrapper: tracking.wrapper });
  return { ...view, tracked: tracking.tracked };
};

/** The properties of the events of one name. */
const propertiesOf = (tracked: ReturnType<typeof renderBar>["tracked"], eventName: string) =>
  tracked(eventName).map(({ properties }) => properties);

describe("BrowseModsBar", () => {
  it("shows the time range that's on, and removes it to all time", async () => {
    const search = searchWith({ timeRange: "7" }, 1);
    renderBar(search);

    expect(screen.getByText("7 days")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove time range filter" }));

    expect(search.setFilters).toHaveBeenCalledWith({ timeRange: "all" });
  });

  it("opens the time ranges from the time range that's on, and picks another", async () => {
    const search = searchWith({ timeRange: "7" }, 1);
    renderBar(search);

    await userEvent.click(screen.getByRole("button", { name: "7 days" }));

    expect(await screen.findByRole("menuitemradio", { name: "Last 7 days" })).toBeChecked();
    expect(screen.queryByRole("menuitem", { name: "Dates" })).toBeNull();

    await userEvent.click(screen.getByRole("menuitemradio", { name: "Last year" }));

    expect(search.setFilters).toHaveBeenCalledWith({ timeRange: "365" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("shows no time range over all time", () => {
    renderBar(searchWith({ timeRange: "all" }, 0));

    expect(
      screen.queryByRole("button", { name: "Remove time range filter" }),
    ).not.toBeInTheDocument();
  });

  it("marks the filter button with a pip while a filter is on", () => {
    const { rerender } = renderBar(searchWith({ timeRange: "7" }, 1));

    expect(screen.getByRole("button", { name: "Filter" })).toHaveClass("nxm-button-pip");

    rerender(<BrowseModsBar search={searchWith({ timeRange: "all" }, 0)} />);

    expect(screen.getByRole("button", { name: "Filter" })).not.toHaveClass("nxm-button-pip");
  });

  it("offers to reset the filters only once they differ from the view's own", async () => {
    const { unmount } = renderBar(searchWith({ timeRange: "7" }, 1));
    await userEvent.click(screen.getByRole("button", { name: "Filter" }));

    expect(screen.queryByText(/^Reset/)).not.toBeInTheDocument();

    unmount();
    renderBar(searchWith({ timeRange: "all" }, 0, 1));
    await userEvent.click(screen.getByRole("button", { name: "Filter" }));

    expect(await screen.findByText("Reset 1 filter to default")).toBeInTheDocument();
  });

  it("counts picking a view, and the one it was on", async () => {
    const { tracked } = renderBar(searchWith({ timeRange: "7" }, 1));

    await userEvent.click(screen.getByRole("button", { name: "Most popular" }));

    expect(propertiesOf(tracked, "browse_mods_view_selected")).toEqual([
      { view: "popular", previous_view: "trending" },
    ]);
  });

  it("counts changing the time range, and where it was changed from", async () => {
    const search = searchWith({ timeRange: "7" }, 1);
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

  it("counts resetting the filters, and how many differed from the view's", async () => {
    const search = searchWith({ timeRange: "all" }, 0, 1);
    const { tracked } = renderBar(search);

    await userEvent.click(screen.getByRole("button", { name: "Filter" }));
    await userEvent.click(await screen.findByText("Reset 1 filter to default"));

    expect(search.resetFilters).toHaveBeenCalled();
    expect(propertiesOf(tracked, "browse_mods_filters_reset")).toEqual([
      { view: "trending", filter_count: 1 },
    ]);
  });

  it("counts turning the sort round, with the sort it ends up as", async () => {
    const search = searchWith({ timeRange: "7" }, 1);
    const { tracked } = renderBar(search);

    await userEvent.click(screen.getByRole("button", { name: "View options" }));
    await userEvent.click(await screen.findByRole("button", { name: "Highest first" }));

    expect(search.setSort).toHaveBeenCalledWith({ direction: "asc" });
    expect(propertiesOf(tracked, "browse_mods_sort_changed")).toEqual([
      { view: "trending", sort_field: "endorsements", sort_direction: "asc", is_reset: false },
    ]);
  });

  it("counts the toolbar's clicks as Browse mods'", async () => {
    const { tracked } = renderBar(searchWith({ timeRange: "all" }, 0));

    await userEvent.click(screen.getByRole("button", { name: "Filter" }));

    expect(propertiesOf(tracked, "app_toolbar_action_clicked")).toEqual([
      expect.objectContaining({ action: "filter", toolbar: "browse_mods" }),
    ]);
  });

  it("does nothing, and counts nothing, when the time range or sort picked is the one on", async () => {
    const search = searchWith({ timeRange: "7" }, 1);
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
      ...searchWith({ timeRange: "7" }, 1),
      sort: { field: "popular", direction: "asc" },
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
    const { tracked } = renderBar(searchWith({ timeRange: "all" }, 0));

    await userEvent.click(screen.getByRole("button", { name: "View options" }));

    expect(propertiesOf(tracked, "app_toolbar_action_clicked")).toEqual([
      expect.objectContaining({ action: "view-options", toolbar: "browse_mods" }),
    ]);
  });
});
