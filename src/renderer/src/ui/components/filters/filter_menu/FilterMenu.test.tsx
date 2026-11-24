import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { FilterMenu, type IFilterMenuItem } from "./FilterMenu";

const ITEMS: IFilterMenuItem[] = [{ label: "Status", icon: "toggle_on", panel: () => <div /> }];

const renderMenu = (onReset?: () => void) =>
  render(
    <FilterMenu
      comingSoon="soon"
      items={ITEMS}
      label="Filters"
      resetLabel="reset"
      onReset={onReset}
      onSelect={vi.fn()}
    />,
  );

describe("FilterMenu", () => {
  it("offers a reset only when given one", () => {
    renderMenu();

    expect(screen.queryByTestId("filter-menu-reset")).toBeNull();
  });

  it("resets from its footer", async () => {
    const onReset = vi.fn();
    renderMenu(onReset);

    await userEvent.click(screen.getByTestId("filter-menu-reset"));

    expect(onReset).toHaveBeenCalledOnce();
  });
});
