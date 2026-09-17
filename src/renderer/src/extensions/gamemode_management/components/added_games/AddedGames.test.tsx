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

// The tiles are the grid's concern and pull in the store.
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

import { AddedGames } from "./AddedGames";

// --- Helpers ---

type Props = React.ComponentProps<typeof AddedGames>;

const game = (id: string): IGameStored => ({
  id,
  name: id,
  executable: undefined,
  extensionPath: undefined,
  requiredFiles: [],
});

const renderComponent = (props: Partial<Props> = {}) => {
  const onSortChange = vi.fn();

  render(
    <AddedGames
      {...({
        count: "0",
        filtering: false,
        games: [],
        sortOrder: "alphabetical",
        onBrowseGameLocation: vi.fn(),
        onRefreshGameInfo: vi.fn(),
        onSortChange,
        ...props,
      } as Props)}
    />,
  );

  return { onSortChange };
};

// --- Tests ---

describe("AddedGames", () => {
  beforeEach(() => {
    state.current = baseState();
  });

  it("renders the games it is given", () => {
    renderComponent({ count: "1", games: [game("skyrim")] });
    expect(screen.getByText("Added games")).toBeInTheDocument();
    expect(screen.getByTestId("games-grid")).toHaveTextContent("skyrim");
  });

  it("uses the list when the layout says so", () => {
    state.current.settings.gameMode.pickerLayout = "list";
    renderComponent({ count: "1", games: [game("skyrim")] });
    expect(screen.getByTestId("games-list")).toHaveTextContent("skyrim");
  });

  it("says nothing is managed yet when the list is empty", () => {
    renderComponent();
    expect(screen.getByText("No games managed yet")).toBeInTheDocument();
  });

  // A search that matched nothing isn't the same as having managed nothing.
  it("reports a search miss instead when filtering", () => {
    renderComponent({ filtering: true });
    expect(screen.getByText("No games found")).toBeInTheDocument();
  });

  it("hands the reader's choice of order back to the caller", async () => {
    const { onSortChange } = renderComponent({ count: "1", games: [game("skyrim")] });

    await userEvent.click(screen.getByRole("button", { name: /Name A-Z/ }));
    await userEvent.click(screen.getByRole("option", { name: "Recently used" }));

    expect(onSortChange).toHaveBeenCalledWith("recentlyused");
  });
});
