import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ModsTableStatus } from "../../util/mods_table_filters/modsTableFilters";
import { ModsTableStatusMenu } from "./ModsTableStatusMenu";

const renderMenu = (status: ModsTableStatus[], onReset?: () => void) => {
  const onChange = vi.fn<(status: ModsTableStatus[]) => void>();
  render(
    <ModsTableStatusMenu
      status={status}
      onChange={onChange}
      onReset={onReset}
      onSelect={vi.fn()}
    />,
  );
  return onChange;
};

const rows = () => screen.getAllByRole("menuitemcheckbox");

describe("ModsTableStatusMenu", () => {
  it("ticks the statuses filtered to", () => {
    renderMenu(["disabled"]);

    expect(rows().map((row) => row.getAttribute("aria-checked"))).toEqual([
      "false",
      "true",
      "false",
    ]);
  });

  it("toggles a status", async () => {
    const onChange = renderMenu(["disabled"]);

    await userEvent.click(rows()[2]);
    expect(onChange).toHaveBeenLastCalledWith(["disabled", "uninstalled"]);

    await userEvent.click(rows()[1]);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("offers a reset only when given one", () => {
    renderMenu(["disabled"]);
    expect(screen.queryByTestId("filter-menu-reset")).toBeNull();
  });
});
