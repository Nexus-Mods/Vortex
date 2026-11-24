import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useMainContext: () => ({ api: { events: { emit: vi.fn() } } }),
}));

import type { ModsTableStatus } from "../../util/mods_table_filters/modsTableFilters";
import { NEW_VIEW_DEFAULTS, type IModsTableView } from "../../util/mods_table_views/modsTableViews";
import { ModsTableToolbar } from "./ModsTableToolbar";

const BUILT_IN: IModsTableView = {
  id: "all",
  label: "modsTable::views::all",
  defaults: NEW_VIEW_DEFAULTS,
};
const MINE: IModsTableView = {
  id: "custom-1",
  label: "Mine",
  defaults: NEW_VIEW_DEFAULTS,
  isCustom: true,
};

const renderToolbar = (selectedView: string, isEdited: boolean, status: ModsTableStatus[] = []) => {
  const onAddView = vi.fn<(name: string, source: string) => void>();
  const onResetFilters = vi.fn();
  const onFiltersChange = vi.fn();
  render(
    <ModsTableToolbar
      changedFilters={isEdited ? ["status"] : []}
      displayOptions={{ id: "view-options", label: "View options", icon: "tune", onClick: vi.fn() }}
      filters={{ status }}
      isEdited={isEdited}
      propertiesOpen={false}
      search=""
      selectedView={selectedView}
      views={[BUILT_IN, MINE]}
      onAddView={onAddView}
      onFiltersChange={onFiltersChange}
      onRemoveView={vi.fn()}
      onRenameView={vi.fn()}
      onResetFilters={onResetFilters}
      onSearchChange={vi.fn()}
      onSelectView={vi.fn()}
      onToggleProperties={vi.fn()}
    />,
  );
  return { onAddView, onFiltersChange, onResetFilters };
};

/** Names a new view in the open naming modal and submits it. */
const nameView = async (name: string) => {
  const dialog = await screen.findByRole("dialog");
  await userEvent.type(within(dialog).getByRole("textbox"), `${name}{Enter}`);
};

describe("ModsTableToolbar", () => {
  it.each<[string, string, boolean, boolean]>([
    ["an unedited built-in view", "all", false, false],
    ["an edited built-in view", "all", true, true],
  ])("shows the edited bar for %s only while it's edited", (_, view, edited, shown) => {
    renderToolbar(view, edited);

    expect(!!screen.queryByTestId("edited-view-save")).toBe(shown);
  });

  it("resets from the bar", async () => {
    const { onResetFilters } = renderToolbar("all", true);

    await userEvent.click(screen.getByTestId("edited-view-reset"));

    expect(onResetFilters).toHaveBeenCalledWith("edited_strip", undefined);
  });

  it("saves from the bar, saying so", async () => {
    const { onAddView } = renderToolbar("all", true);

    await userEvent.click(screen.getByTestId("edited-view-save"));
    await nameView("Mine too");

    expect(onAddView).toHaveBeenCalledWith("Mine too", "edited_strip");
  });

  it("saves from the picker's add as from the bar, saying so", async () => {
    const { onAddView } = renderToolbar("all", true);

    await userEvent.click(screen.getByTestId("view-picker-add"));
    await nameView("Mine too");

    expect(onAddView).toHaveBeenCalledWith("Mine too", "picker");
  });

  describe("status filter", () => {
    it("shows no chip while nothing is ticked", () => {
      renderToolbar("all", false);

      expect(screen.queryByTestId("mods-table-status-chip")).toBeNull();
    });

    it("clears status from the chip's ×, as a change of filter", async () => {
      const { onFiltersChange, onResetFilters } = renderToolbar("all", true, ["enabled"]);

      await userEvent.click(screen.getByTestId("mods-table-status-chip-remove"));

      expect(onFiltersChange).toHaveBeenCalledWith({ status: [] });
      expect(onResetFilters).not.toHaveBeenCalled();
    });

    it("opens the chip's choices without a reset, as Browse's chips do", async () => {
      renderToolbar("all", true, ["enabled"]);

      await userEvent.click(screen.getByTestId("mods-table-status-chip"));

      expect(await screen.findAllByRole("menuitemcheckbox")).toHaveLength(3);
      expect(screen.queryByTestId("filter-menu-reset")).toBeNull();
    });

    it("offers the menu's reset on an edited built-in view", async () => {
      renderToolbar("all", true, ["enabled"]);

      await userEvent.click(screen.getByTestId("mods-table-filter"));

      expect(await screen.findByTestId("filter-menu-reset")).toBeInTheDocument();
    });

    it("shows the chip on the user's own view, without the bar or the menu's reset", async () => {
      renderToolbar("custom-1", false, ["enabled"]);

      expect(screen.getByTestId("mods-table-status-chip")).toBeInTheDocument();
      expect(screen.queryByTestId("edited-view-reset")).toBeNull();

      await userEvent.click(screen.getByTestId("mods-table-filter"));

      expect(await screen.findByRole("menu")).toBeInTheDocument();
      expect(screen.queryByTestId("filter-menu-reset")).toBeNull();
    });
  });
});
