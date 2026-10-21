import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { IGameStored } from "../types/IGameStored";

// The card reads the store and draws the tile; this file checks what each card is handed.
vi.mock("./GameCard", () => ({
  GameCard: ({ detectedStore, game }: { detectedStore?: string; game: IGameStored }) => (
    <div data-store={detectedStore} data-testid={`card-${game.id}`} />
  ),
}));

import { GamesGrid } from "./GamesGrid";

const game = (id: string): IGameStored => ({
  id,
  name: id,
  executable: undefined,
  extensionPath: undefined,
  requiredFiles: [],
});

describe("GamesGrid", () => {
  it("hands each card the store its game was detected on", () => {
    render(
      <GamesGrid
        detectedStores={{ cyberpunk2077: "gog", skyrimse: "steam" }}
        games={[game("skyrimse"), game("cyberpunk2077"), game("fallout4")]}
        section="detected"
        onRefreshGameInfo={vi.fn<(gameId: string) => PromiseLike<void>>()}
      />,
    );

    expect(screen.getByTestId("card-skyrimse")).toHaveAttribute("data-store", "steam");
    expect(screen.getByTestId("card-cyberpunk2077")).toHaveAttribute("data-store", "gog");
    // a game the map has nothing for doesn't borrow a neighbour's store
    expect(screen.getByTestId("card-fallout4")).not.toHaveAttribute("data-store");
  });

  it("hands no store in a section that has none to give", () => {
    render(
      <GamesGrid
        games={[game("skyrimse")]}
        section="added"
        onRefreshGameInfo={vi.fn<(gameId: string) => PromiseLike<void>>()}
      />,
    );

    expect(screen.getByTestId("card-skyrimse")).not.toHaveAttribute("data-store");
  });
});
