import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { browseModsTracking } from "@/test-utils/browseModsTracking";
import type { IToolbarPanelHandle } from "@/ui/components/toolbar/ToolbarPanelButton";

import { type IModFilters, NO_FILTERS } from "../../util/mod_views/modViews";
import type { IModSearch } from "../use_mod_search/useModSearch.hook";
import { useBrowseModsViews } from "./useBrowseModsViews.hook";

/**
 * The search the views are for, with its filters (those not given as no filter has them) and how
 * many of them are on.
 */
const searchWith = (
  filters: Partial<IModFilters>,
  activeFilterCount: number,
  changedFilterCount = 0,
) =>
  ({
    viewId: "trending",
    trackedView: "trending",
    views: [],
    isEdited: false,
    sort: { field: "endorsements", direction: "desc" },
    filters: { ...NO_FILTERS, ...filters },
    activeFilterCount,
    changedFilterCount,
    selectView: vi.fn(),
    resetView: vi.fn(),
    addView: vi.fn(),
    renameView: vi.fn(),
    removeView: vi.fn(),
  }) as unknown as IModSearch;

/** Places the views' picker and strip, as Browse's mods tab does. */
const Views = ({ search }: { search: IModSearch }) => {
  const filters = useRef<IToolbarPanelHandle>(null);
  const viewOptions = useRef<IToolbarPanelHandle>(null);
  const { viewPicker, editedViewStrip } = useBrowseModsViews(search, { filters, viewOptions });

  return (
    <>
      {viewPicker}
      {editedViewStrip}
    </>
  );
};

/** Renders the views for the search, with a tracker whose events it returns. */
const renderBar = (search: IModSearch) => {
  const tracking = browseModsTracking();
  const view = render(<Views search={search} />, { wrapper: tracking.wrapper });
  return { ...view, tracked: tracking.tracked };
};

/** The properties of the events of one name. */
const propertiesOf = (tracked: ReturnType<typeof renderBar>["tracked"], eventName: string) =>
  tracked(eventName).map(({ properties }) => properties);

describe("useBrowseModsViews", () => {
  it("counts picking a view, and the one it was on", async () => {
    const { tracked } = renderBar(searchWith({ timeRange: "7" }, 1));

    await userEvent.click(screen.getByRole("button", { name: "Most popular" }));

    expect(propertiesOf(tracked, "browse_mods_view_selected")).toEqual([
      { view: "popular", previous_view: "trending" },
    ]);
  });

  it("counts picking the open preset again while its filters are changed, which puts them back", async () => {
    const search = searchWith({ timeRange: "28" }, 1, 1);
    const { tracked } = renderBar(search);

    await userEvent.click(screen.getByRole("button", { name: "Trending" }));

    expect(search.selectView).toHaveBeenCalledWith("trending");
    expect(propertiesOf(tracked, "browse_mods_view_selected")).toEqual([
      { view: "trending", previous_view: "trending" },
    ]);
  });

  it("doesn't count picking the open view again when that changes nothing", async () => {
    const { tracked } = renderBar(searchWith({ timeRange: "7" }, 1));

    await userEvent.click(screen.getByRole("button", { name: "Trending" }));

    expect(propertiesOf(tracked, "browse_mods_view_selected")).toEqual([]);
  });

  describe("views of the user's own", () => {
    const mine = {
      id: "custom-1",
      name: "Mine",
      sort: { field: "downloads", direction: "desc" },
      filters: { timeRange: "28" },
    };

    const withMine = () =>
      ({ ...searchWith({ timeRange: "7" }, 1), views: [mine] }) as unknown as IModSearch;

    it("lists them after the presets, by name", () => {
      renderBar(withMine());

      expect(screen.getByRole("button", { name: "Mine" })).toBeInTheDocument();
    });

    it("saves what's showing as one from the +, by name, counting it", async () => {
      const search = searchWith({ timeRange: "7" }, 1);
      const { tracked } = renderBar(search);

      await userEvent.click(screen.getByRole("button", { name: "Add view" }));
      await userEvent.type(screen.getByRole("textbox", { name: "Name view" }), "Weekly{Enter}");

      expect(search.addView).toHaveBeenCalledWith("Weekly");
      expect(propertiesOf(tracked, "browse_mods_view_created")).toEqual([
        { view: "trending", source: "picker" },
      ]);
    });

    it("renames one from its menu, starting from its name", async () => {
      const search = withMine();
      const { tracked } = renderBar(search);

      await userEvent.click(screen.getByRole("button", { name: /view actions/ }));
      await userEvent.click(await screen.findByRole("menuitem", { name: "Rename view" }));
      const field = screen.getByRole("textbox", { name: "Name view" });
      expect(field).toHaveValue("Mine");
      await userEvent.clear(field);
      await userEvent.type(field, "Theirs{Enter}");

      expect(search.renameView).toHaveBeenCalledWith("custom-1", "Theirs");
      expect(tracked("browse_mods_view_renamed")).toHaveLength(1);
    });

    it("offers to edit its filters, above its view options, opening it to do so", async () => {
      const search = withMine();
      renderBar(search);

      await userEvent.click(screen.getByRole("button", { name: /view actions/ }));
      const items = (await screen.findAllByRole("menuitem")).map((item) => item.textContent);
      expect(items.indexOf("Edit filters")).toBe(items.indexOf("Edit view options") - 1);

      await userEvent.click(screen.getByRole("menuitem", { name: "Edit filters" }));
      expect(search.selectView).toHaveBeenCalledWith("custom-1");
    });

    it("deletes one from its menu once asked, counting it", async () => {
      const search = withMine();
      const { tracked } = renderBar(search);

      await userEvent.click(screen.getByRole("button", { name: /view actions/ }));
      await userEvent.click(await screen.findByRole("menuitem", { name: "Delete view" }));
      await userEvent.click(screen.getByRole("button", { name: "Delete view" }));

      expect(search.removeView).toHaveBeenCalledWith("custom-1");
      expect(tracked("browse_mods_view_deleted")).toHaveLength(1);
    });

    it("counts picking one as a custom view, never by name", async () => {
      const search = withMine();
      const { tracked } = renderBar(search);

      await userEvent.click(screen.getByRole("button", { name: "Mine" }));

      expect(search.selectView).toHaveBeenCalledWith("custom-1");
      expect(propertiesOf(tracked, "browse_mods_view_selected")).toEqual([
        { view: "custom", previous_view: "trending" },
      ]);
    });
  });

  describe("an edited preset", () => {
    const edited = () =>
      ({ ...searchWith({ timeRange: "28" }, 1, 1), isEdited: true }) as unknown as IModSearch;

    it("says so, naming it", () => {
      renderBar(edited());

      expect(screen.getByText("{{view}} view has been edited")).toBeInTheDocument();
    });

    it("isn't said while it's as it comes", () => {
      renderBar(searchWith({ timeRange: "7" }, 1));

      expect(screen.queryByText("{{view}} view has been edited")).not.toBeInTheDocument();
    });

    it("puts it back as it comes, counting it", async () => {
      const search = edited();
      const { tracked } = renderBar(search);

      await userEvent.click(screen.getByRole("button", { name: "Reset to default" }));

      expect(search.resetView).toHaveBeenCalled();
      expect(propertiesOf(tracked, "browse_mods_view_reset")).toEqual([{ view: "trending" }]);
    });

    it("saves it as a view of the user's own", async () => {
      const search = edited();
      const { tracked } = renderBar(search);

      await userEvent.click(screen.getByRole("button", { name: "Save view" }));
      await userEvent.type(screen.getByRole("textbox", { name: "Name view" }), "Monthly{Enter}");

      expect(search.addView).toHaveBeenCalledWith("Monthly");
      expect(propertiesOf(tracked, "browse_mods_view_created")).toEqual([
        { view: "trending", source: "edited_strip" },
      ]);
    });
  });
});
