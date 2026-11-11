import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { EmptyStateKind } from "../../../util/empty_state_kind/emptyStateKind";
import { ModListEmptyState } from "./ModListEmptyState";

type IProps = React.ComponentProps<typeof ModListEmptyState>;

/** Renders a state, with callbacks to spy on. */
const renderState = (kind: EmptyStateKind, props: Partial<IProps> = {}) => {
  const callbacks = {
    onRemoveFilters: vi.fn(),
    onClearSearch: vi.fn(),
    onSearchWebsite: vi.fn(),
    onLearnMore: vi.fn(),
  };
  render(
    <ModListEmptyState
      filterCount={0}
      gameName="Skyrim Special Edition"
      kind={kind}
      searchText={'say "hi"'}
      {...callbacks}
      {...props}
    />,
  );
  return callbacks;
};

describe("ModListEmptyState", () => {
  it.each<[EmptyStateKind, string]>([
    ["end_of_results", "You've reached the end"],
    ["search_only", 'No mods match "{{search}}"'],
    ["search_and_filters", 'No mods match "{{search}}"'],
    ["filters_only", "No mods match your filters"],
    ["nothing_for_game", "No mods to show for {{game}}"],
  ])("shows the %s state's heading", (kind, title) => {
    renderState(kind, { filterCount: 1 });
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it("falls back to this game without a game name", () => {
    renderState("nothing_for_game", { gameName: undefined });
    expect(screen.getByText("No mods to show for this game")).toBeInTheDocument();
  });

  it("offers Remove N filters, counted, only where the state lists it", () => {
    renderState("filters_only", { filterCount: 2 });
    expect(screen.getByRole("button", { name: "Remove {{count}} filters" })).toBeInTheDocument();
  });

  it("says Remove 1 filter for one", () => {
    renderState("search_and_filters", { filterCount: 1 });
    expect(screen.getByRole("button", { name: "Remove 1 filter" })).toBeInTheDocument();
  });

  it("offers no Remove filters for a search alone", () => {
    renderState("search_only", { filterCount: 0 });
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
  });

  it("offers Remove filters at the end while any are on", () => {
    renderState("end_of_results", { filterCount: 1 });
    expect(screen.getByRole("button", { name: "Remove 1 filter" })).toBeInTheDocument();
  });

  it("leaves out Remove filters at the end with none on", () => {
    renderState("end_of_results", { filterCount: 0 });
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
  });

  it("calls back for each action", async () => {
    const callbacks = renderState("filters_only", { filterCount: 2 });

    await userEvent.click(screen.getByRole("button", { name: "Remove {{count}} filters" }));
    await userEvent.click(screen.getByRole("button", { name: "Search on website" }));

    expect(callbacks.onRemoveFilters).toHaveBeenCalledOnce();
    expect(callbacks.onSearchWebsite).toHaveBeenCalledOnce();
  });

  it.each<EmptyStateKind>(["search_only", "search_and_filters", "end_of_results"])(
    "offers to clear the search in the %s state while there's one",
    async (kind) => {
      const callbacks = renderState(kind);

      await userEvent.click(screen.getByRole("button", { name: "Clear search" }));

      expect(callbacks.onClearSearch).toHaveBeenCalledOnce();
    },
  );

  it.each<EmptyStateKind>(["filters_only", "nothing_for_game"])(
    "doesn't offer to clear a search in the %s state",
    (kind) => {
      renderState(kind);
      expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    },
  );

  it("doesn't offer to clear a search at the end without one", () => {
    renderState("end_of_results", { searchText: undefined });
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("says the end is every mod for the search while there's one, or for the view", () => {
    const { unmount } = render(
      <ModListEmptyState
        filterCount={0}
        kind="end_of_results"
        searchText="sky"
        onClearSearch={vi.fn()}
        onLearnMore={vi.fn()}
        onRemoveFilters={vi.fn()}
      />,
    );
    expect(
      screen.getByText("That's every mod Vortex can show for this search."),
    ).toBeInTheDocument();

    unmount();
    renderState("end_of_results", { searchText: undefined });
    expect(screen.getByText("That's every mod Vortex can show for this view.")).toBeInTheDocument();
  });

  it("leaves out Search on website without somewhere to search", () => {
    renderState("nothing_for_game", { onSearchWebsite: undefined });
    expect(screen.queryByRole("button", { name: "Search on website" })).toBeNull();
  });

  it("notes that some mods are hidden", () => {
    renderState("nothing_for_game");
    expect(
      screen.getByText(
        "Mods that don't support mod managers or use legacy requirements are hidden.",
      ),
    ).toBeInTheDocument();
  });

  it("hides Learn more while it has nowhere to go", () => {
    renderState("nothing_for_game");
    expect(screen.queryByRole("link", { name: "Learn more" })).toBeNull();
  });
});
