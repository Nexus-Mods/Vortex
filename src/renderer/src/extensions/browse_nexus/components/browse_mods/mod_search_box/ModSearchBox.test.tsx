import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { browseModsTracking } from "@/test-utils/browseModsTracking";

import { ModSearchBox } from "./ModSearchBox";

type ISearch = React.ComponentProps<typeof ModSearchBox>["search"];

/** The search, searching for this text in this view. */
const searching = (searchText: string, viewId = "trending"): ISearch => ({
  searchText,
  viewId,
  trackedView: "trending",
  setSearchText: vi.fn(),
});

/** Renders the box over the search, with a tracker whose events it returns by name. */
const renderBox = (search: ISearch) => {
  const tracking = browseModsTracking();
  const view = render(<ModSearchBox search={search} />, { wrapper: tracking.wrapper });

  return {
    rerender: (next: ISearch) => view.rerender(<ModSearchBox search={next} />),
    propertiesOf: (eventName: string) =>
      tracking.tracked(eventName).map(({ properties }) => properties),
  };
};

const box = () => screen.getByRole("textbox", { name: "Search mods..." });

describe("ModSearchBox", () => {
  it("searches on Enter, counting how long the search is", async () => {
    const search = searching("");
    const { propertiesOf } = renderBox(search);

    await userEvent.type(box(), "skyui{Enter}");

    expect(search.setSearchText).toHaveBeenCalledWith("skyui");
    expect(propertiesOf("browse_mods_search_submitted")).toEqual([
      { view: "trending", query_length: 5 },
    ]);
  });

  it("says a search is too short on Enter, without searching, until the text changes", async () => {
    const search = searching("");
    const { propertiesOf } = renderBox(search);

    await userEvent.type(box(), "a{Enter}");

    expect(search.setSearchText).not.toHaveBeenCalled();
    expect(propertiesOf("browse_mods_search_submitted")).toEqual([]);
    expect(box()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    await userEvent.type(box(), "b");

    expect(box()).not.toHaveAttribute("aria-invalid", "true");
  });

  it("drops the too-short hint once focus leaves the box", async () => {
    renderBox(searching(""));
    await userEvent.type(box(), "a{Enter}");

    await userEvent.tab();

    expect(box()).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("clears the search on Enter with only spaces, counting it", async () => {
    const search = searching("chest");
    const { propertiesOf } = renderBox(search);

    await userEvent.type(box(), "   {Enter}", { initialSelectionStart: 0, initialSelectionEnd: 5 });

    expect(search.setSearchText).toHaveBeenCalledWith("");
    expect(propertiesOf("browse_mods_search_cleared")).toEqual([
      { view: "trending", source: "box" },
    ]);
  });

  it("neither searches nor counts Enter on what's already searched for", async () => {
    const search = searching("chest");
    const { propertiesOf } = renderBox(search);

    await userEvent.type(box(), " {Enter}");

    expect(search.setSearchText).not.toHaveBeenCalled();
    expect(propertiesOf("browse_mods_search_submitted")).toEqual([]);
  });

  it("clears the search at once when the box is emptied, counting it", async () => {
    const search = searching("skyui");
    const { propertiesOf } = renderBox(search);

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(search.setSearchText).toHaveBeenCalledWith("");
    expect(propertiesOf("browse_mods_search_cleared")).toEqual([
      { view: "trending", source: "box" },
    ]);
  });

  it("counts no clearing when there was no search to clear", async () => {
    const search = searching("");
    const { propertiesOf } = renderBox(search);

    await userEvent.type(box(), "a{Backspace}");

    expect(search.setSearchText).not.toHaveBeenCalled();
    expect(propertiesOf("browse_mods_search_cleared")).toEqual([]);
  });

  it("follows the text searched for when it changes from outside the box", () => {
    const { rerender } = renderBox(searching("skyui"));

    rerender(searching(""));

    expect(box()).toHaveValue("");
  });

  it("drops an edit not yet searched for when another view opens", async () => {
    const { rerender } = renderBox(searching("chest"));
    await userEvent.type(box(), " xyz");

    rerender(searching("chest", "new"));

    expect(box()).toHaveValue("chest");
  });

  it("keeps focus in the box once it's searched", async () => {
    const search = searching("");
    const { rerender } = renderBox(search);

    await userEvent.type(box(), "skyui{Enter}");
    rerender(searching("skyui"));

    expect(box()).toHaveFocus();
  });

  it("takes no more than the API searches for", () => {
    renderBox(searching(""));

    expect(box()).toHaveAttribute("maxlength", "100");
  });
});
