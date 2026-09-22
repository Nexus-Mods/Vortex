import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type * as ReactReduxTypes from "react-redux";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { IGameStored } from "../../types/IGameStored";

const { baseState, state } = vi.hoisted(() => {
  const baseState = () => ({
    persistent: { profiles: {} },
    settings: {
      gameMode: { discovered: {}, pickerLayout: "small" },
      profiles: { activeProfileId: undefined },
    },
  });

  return { baseState, state: { current: baseState() } };
});

vi.mock("react-redux", async () => {
  const actual = await vi.importActual<typeof ReactReduxTypes>("react-redux");

  return {
    ...actual,
    useSelector: (selector: (input: unknown) => unknown) => selector(state.current),
  };
});

vi.mock("../GamesGrid", () => ({
  GamesGrid: ({ games }: { games: IGameStored[] }) => (
    <div data-testid="games-grid">{games.map((iter) => iter.name).join(",")}</div>
  ),
}));

vi.mock("../GamesList", () => ({
  GamesList: ({ games }: { games: IGameStored[] }) => (
    <div data-testid="games-list">{games.map((iter) => iter.name).join(",")}</div>
  ),
}));

import { SupportedGames } from "./SupportedGames";

// --- Helpers ---

type Props = React.ComponentProps<typeof SupportedGames>;

const games = (count: number): IGameStored[] =>
  Array.from({ length: count }, (_unused, idx) => ({
    id: `game${idx}`,
    name: `game${idx}`,
    executable: undefined,
    extensionPath: undefined,
    requiredFiles: [],
  }));

const renderComponent = (props: Partial<Props> = {}) => {
  const onPageChange = vi.fn();
  const onSortChange = vi.fn();

  const view = render(
    <SupportedGames
      {...({
        count: "0",
        filterValue: "",
        games: [],
        sortOrder: "popular",
        onBrowseGameLocation: vi.fn(),
        onPageChange,
        onRefreshGameInfo: vi.fn(),
        onSortChange,
        ...props,
      } as Props)}
    />,
  );

  return { onPageChange, onSortChange, view };
};

const shownNames = () => screen.getByTestId("games-grid").textContent?.split(",") ?? [];

// --- Tests ---

describe("SupportedGames", () => {
  beforeEach(() => {
    state.current = baseState();
  });

  it("renders the section and its games", () => {
    renderComponent({ count: "2", games: games(2) });
    expect(screen.getByText("All supported games")).toBeInTheDocument();
    expect(shownNames()).toEqual(["game0", "game1"]);
  });

  describe("paging", () => {
    // The catalogue runs to hundreds of games, so only a page of them is rendered.
    it("shows only the first page of a long list", () => {
      renderComponent({ count: "120", games: games(120) });
      expect(shownNames()).toHaveLength(49);
      expect(shownNames()[0]).toBe("game0");
    });

    it("tells the caller when the page changed, so it can scroll back up", async () => {
      const { onPageChange } = renderComponent({ count: "120", games: games(120) });

      await userEvent.click(screen.getByRole("button", { name: "Go to page 2" }));

      expect(shownNames()[0]).toBe("game49");
      expect(onPageChange).toHaveBeenCalledOnce();
    });

    // A new search rebuilds the list, so staying on page 3 would strand the reader.
    it("starts again from the first page when the search changes", async () => {
      const { view } = renderComponent({ count: "120", games: games(120) });

      await userEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
      expect(shownNames()[0]).toBe("game49");

      view.rerender(
        <SupportedGames
          count="120"
          filterValue="skyrim"
          games={games(120)}
          sortOrder="popular"
          onBrowseGameLocation={vi.fn()}
          onPageChange={vi.fn()}
          onRefreshGameInfo={vi.fn()}
          onSortChange={vi.fn()}
        />,
      );

      expect(shownNames()[0]).toBe("game0");
    });
  });

  it("hands the reader's choice of order back to the caller", async () => {
    const { onSortChange } = renderComponent({ count: "1", games: games(1) });

    await userEvent.click(screen.getByRole("button", { name: /Most Popular/ }));
    await userEvent.click(screen.getByRole("option", { name: "Name A-Z" }));

    expect(onSortChange).toHaveBeenCalledWith("alphabetical");
  });
});
