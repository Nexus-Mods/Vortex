import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { Popover } from "@/ui/components/popover/Popover";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";

import type { IModFilters } from "../../../hooks/use_mod_search/useModSearch.hook";
import { ModFilters } from "./ModFilters";

/** The filters, hung off a trigger as the bar's filter button hangs them, and opened. */
const openFilters = async (filters: IModFilters, activeCount: number) => {
  const onChange = vi.fn();
  const onReset = vi.fn();

  render(
    <Popover>
      <PopoverButton>Filter</PopoverButton>

      <PopoverPanel className="nxm-popover-panel-dropdown">
        {({ close }) => (
          <ModFilters
            activeCount={activeCount}
            filters={filters}
            onChange={onChange}
            onReset={onReset}
            onSelect={close}
          />
        )}
      </PopoverPanel>
    </Popover>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Filter" }));

  return { onChange, onReset };
};

describe("ModFilters", () => {
  it("offers each time range under Dates, the chosen one checked", async () => {
    await openFilters({ timeRange: "7" }, 1);

    await userEvent.click(screen.getByRole("menuitem", { name: "Dates" }));

    expect(screen.getAllByRole("menuitemradio").map((row) => row.textContent)).toEqual([
      "Last 24 hours",
      "Last 7 days",
      "Last 14 days",
      "Last 28 days",
      "Last year",
      "All time",
    ]);
    expect(screen.getByRole("menuitemradio", { name: "Last 7 days" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("filters by the time range picked", async () => {
    const { onChange } = await openFilters({ timeRange: "all" }, 0);

    await userEvent.click(screen.getByRole("menuitem", { name: "Dates" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Last 28 days" }));

    expect(onChange).toHaveBeenCalledWith({ timeRange: "28" });
  });

  it("says more filters are coming", async () => {
    await openFilters({ timeRange: "all" }, 0);

    expect(screen.getByText("More filters coming soon...")).toBeInTheDocument();
  });

  it("offers to reset the filter while one is on", async () => {
    const { onReset } = await openFilters({ timeRange: "7" }, 1);

    await userEvent.click(screen.getByRole("button", { name: "Reset 1 filter to default" }));

    expect(onReset).toHaveBeenCalled();
  });

  it("counts the filters it resets while more than one is on", async () => {
    await openFilters({ timeRange: "7" }, 2);

    expect(
      screen.getByRole("button", { name: "Reset {{count}} filters to default" }),
    ).toBeInTheDocument();
  });

  it("offers no reset while no filter is on", async () => {
    await openFilters({ timeRange: "all" }, 0);

    expect(screen.queryByRole("button", { name: /^Reset/ })).not.toBeInTheDocument();
  });
});
