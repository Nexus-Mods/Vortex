import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { IModFilters, IModSearch } from "../../../hooks/use_mod_search/useModSearch.hook";
import { BrowseModsBar } from "./BrowseModsBar";

/** The search the bar shows, with its filters and how many of them are on. */
const searchWith = (filters: IModFilters, activeFilterCount: number) =>
  ({
    preset: "trending",
    sort: { field: "trending", direction: "desc" },
    filters,
    activeFilterCount,
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
});
