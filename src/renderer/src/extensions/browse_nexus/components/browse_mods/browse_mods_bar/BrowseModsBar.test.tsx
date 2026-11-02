import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

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

describe("BrowseModsBar", () => {
  it("shows the time range that's on, and removes it to all time", async () => {
    const search = searchWith({ timeRange: "7" }, 1);
    render(<BrowseModsBar search={search} />);

    expect(screen.getByText("7 days")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove time range filter" }));

    expect(search.setFilters).toHaveBeenCalledWith({ timeRange: "all" });
  });

  it("opens the time ranges from the time range that's on, and picks another", async () => {
    const search = searchWith({ timeRange: "7" }, 1);
    render(<BrowseModsBar search={search} />);

    await userEvent.click(screen.getByRole("button", { name: "7 days" }));

    expect(await screen.findByRole("menuitemradio", { name: "Last 7 days" })).toBeChecked();
    expect(screen.queryByRole("menuitem", { name: "Dates" })).toBeNull();

    await userEvent.click(screen.getByRole("menuitemradio", { name: "Last year" }));

    expect(search.setFilters).toHaveBeenCalledWith({ timeRange: "365" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("shows no time range over all time", () => {
    render(<BrowseModsBar search={searchWith({ timeRange: "all" }, 0)} />);

    expect(
      screen.queryByRole("button", { name: "Remove time range filter" }),
    ).not.toBeInTheDocument();
  });

  it("marks the filter button with a pip while a filter is on", () => {
    const { rerender } = render(<BrowseModsBar search={searchWith({ timeRange: "7" }, 1)} />);

    expect(screen.getByRole("button", { name: "Filter" })).toHaveClass("nxm-button-pip");

    rerender(<BrowseModsBar search={searchWith({ timeRange: "all" }, 0)} />);

    expect(screen.getByRole("button", { name: "Filter" })).not.toHaveClass("nxm-button-pip");
  });

  it("offers to reset the filters only once they differ from the view's own", async () => {
    const { unmount } = render(<BrowseModsBar search={searchWith({ timeRange: "7" }, 1)} />);
    await userEvent.click(screen.getByRole("button", { name: "Filter" }));

    expect(screen.queryByText(/^Reset/)).not.toBeInTheDocument();

    unmount();
    render(<BrowseModsBar search={searchWith({ timeRange: "all" }, 0, 1)} />);
    await userEvent.click(screen.getByRole("button", { name: "Filter" }));

    expect(await screen.findByText("Reset 1 filter to default")).toBeInTheDocument();
  });
});
