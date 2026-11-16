import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { Popover } from "@/ui/components/popover/Popover";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";

import { type IModFilters, NO_FILTERS } from "../../../util/mod_views/modViews";
import { ModFilters } from "./ModFilters";

/**
 * The filters, hung off a trigger as the bar's filter button hangs them, and opened; those not
 * given are as no filter has them, those given narrow the mods, and the user is logged in and can
 * see adult content unless said otherwise.
 */
const openFilters = async (
  filters: Partial<IModFilters>,
  changedFilters: Array<keyof IModFilters> = [],
  canSeeAdult = true,
  isLoggedIn = true,
) => {
  const onChange = vi.fn();
  const onReset = vi.fn();
  const onResetFilter = vi.fn();

  render(
    <Popover>
      <PopoverButton>Filter</PopoverButton>

      <PopoverPanel className="nxm-popover-panel-dropdown">
        {({ close }) => (
          <ModFilters
            canSeeAdult={canSeeAdult}
            changedFilters={changedFilters}
            filters={{ ...NO_FILTERS, ...filters }}
            isLoggedIn={isLoggedIn}
            onChange={onChange}
            onReset={onReset}
            onResetFilter={onResetFilter}
            onSelect={close}
          />
        )}
      </PopoverPanel>
    </Popover>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Filter" }));

  return { onChange, onReset, onResetFilter };
};

describe("ModFilters", () => {
  it("offers each time range under Dates, the chosen one checked", async () => {
    await openFilters({ timeRange: "7" }, ["timeRange"]);

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
    const { onChange } = await openFilters({ timeRange: "all" });

    await userEvent.click(screen.getByRole("menuitem", { name: "Dates" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Last 28 days" }));

    expect(onChange).toHaveBeenCalledWith({ timeRange: "28" });
  });

  it("says more filters are coming", async () => {
    await openFilters({});

    expect(screen.getByText("More filters coming soon...")).toBeInTheDocument();
  });

  it("offers to reset the filter while one differs from the view's", async () => {
    const { onReset } = await openFilters({ timeRange: "7" }, ["timeRange"]);

    await userEvent.click(screen.getByRole("button", { name: "Reset 1 filter to default" }));

    expect(onReset).toHaveBeenCalled();
  });

  it("counts the filters it resets while more than one differs", async () => {
    await openFilters({ timeRange: "7", adult: "exclude" }, ["timeRange", "adult"]);

    expect(
      screen.getByRole("button", { name: "Reset {{count}} filters to default" }),
    ).toBeInTheDocument();
  });

  it("offers no reset while the filters are the view's", async () => {
    await openFilters({});

    expect(screen.queryByRole("button", { name: /^Reset/ })).not.toBeInTheDocument();
  });

  it("offers to put the time range back from Dates while it differs from the view's", async () => {
    const { onResetFilter } = await openFilters({ timeRange: "28" }, ["timeRange"]);

    await userEvent.click(screen.getByRole("menuitem", { name: "Dates" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset date to default" }));

    expect(onResetFilter).toHaveBeenCalledWith("timeRange");
  });

  it("offers no reset in Dates while the time range is the view's", async () => {
    await openFilters({ timeRange: "7" }, ["adult"]);

    await userEvent.click(screen.getByRole("menuitem", { name: "Dates" }));

    expect(screen.queryByRole("button", { name: "Reset date to default" })).not.toBeInTheDocument();
  });

  it("offers each adult content choice, the chosen one checked", async () => {
    await openFilters({ adult: "exclude" }, ["adult"]);

    await userEvent.click(screen.getByRole("menuitem", { name: "Adult content" }));

    expect(screen.getAllByRole("menuitemradio").map((row) => row.textContent)).toEqual([
      "Show all content",
      "Hide adult content",
      "Show only adult content",
    ]);
    expect(screen.getByRole("menuitemradio", { name: "Hide adult content" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("filters by the adult content choice picked", async () => {
    const { onChange } = await openFilters({});

    await userEvent.click(screen.getByRole("menuitem", { name: "Adult content" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Show only adult content" }));

    expect(onChange).toHaveBeenCalledWith({ adult: "only" });
  });

  it("offers to put adult content back from its submenu while it differs from the view's", async () => {
    const { onResetFilter } = await openFilters({ adult: "only" }, ["adult"]);

    await userEvent.click(screen.getByRole("menuitem", { name: "Adult content" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset adult content to default" }));

    expect(onResetFilter).toHaveBeenCalledWith("adult");
  });

  it("locks adult content on hiding it for a user who can't see it", async () => {
    const { onChange } = await openFilters({ adult: "exclude" }, [], false);

    await userEvent.click(screen.getByRole("menuitem", { name: "Adult content" }));
    const choices = screen.getAllByRole("menuitemradio");

    expect(choices.every((row) => (row as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getByRole("menuitemradio", { name: "Hide adult content" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await userEvent.click(choices[2]);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Adult content is disabled in your preferences")).toBeInTheDocument();
  });
});
