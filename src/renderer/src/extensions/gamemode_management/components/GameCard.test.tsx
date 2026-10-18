import { render, screen } from "@testing-library/react";
import React from "react";
import type * as ReactReduxTypes from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IGameStored } from "../types/IGameStored";

const { state } = vi.hoisted(() => ({
  state: {
    current: {
      persistent: { profiles: {} },
      settings: {
        gameMode: { discovered: {} },
        profiles: { activeProfileId: undefined },
      },
    },
  },
}));

vi.mock("@/contexts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useMainContext: () => ({ api: { events: { emit: vi.fn<() => void>() } } }),
}));

vi.mock("react-redux", async () => {
  const actual = await vi.importActual<typeof ReactReduxTypes>("react-redux");

  return {
    ...actual,
    useSelector: (selector: (input: unknown) => unknown) => selector(state.current),
  };
});

vi.mock("../hooks/use_game_card_actions/useGameCardActions.hook", () => ({
  useGameCardActions: () => ({ menu: [], primary: undefined }),
}));

// The art resolves through the Nexus games list, which this file has no need of.
vi.mock("../util/gameArtURL", () => ({ gameArtURL: () => undefined }));

// How each store reads on the pill is GameTile's to test; this file checks which store
// the card hands the tile.
vi.mock("@/ui/components/game_tile/GameTile", () => ({
  GameTile: ({ store }: { store?: string }) => <div data-store={store} data-testid="game-tile" />,
}));

import { GameCard } from "./GameCard";

const skyrim: IGameStored = {
  id: "skyrimse",
  name: "Skyrim Special Edition",
  executable: undefined,
  extensionPath: undefined,
  requiredFiles: [],
};

describe("GameCard", () => {
  beforeEach(() => {
    state.current.settings.gameMode.discovered = {};
  });

  // A game whose extension isn't installed has never been through discovery.
  it("names the detected store for a game discovery hasn't found", () => {
    render(<GameCard detectedStore="steam" game={skyrim} section="detected" />);

    expect(screen.getByTestId("game-tile")).toHaveAttribute("data-store", "steam");
  });

  it("names the store discovery found over the detected one", () => {
    state.current.settings.gameMode.discovered = { skyrimse: { store: "gog" } };
    render(<GameCard detectedStore="steam" game={skyrim} section="detected" />);

    expect(screen.getByTestId("game-tile")).toHaveAttribute("data-store", "gog");
  });

  // Discovery records a path with no store when identifyStore can't place it, including a
  // path the user set by hand and left on "Other".
  it("names the detected store when discovery found the game but not its store", () => {
    state.current.settings.gameMode.discovered = { skyrimse: { path: "C:/Games/Skyrim" } };
    render(<GameCard detectedStore="steam" game={skyrim} section="detected" />);

    expect(screen.getByTestId("game-tile")).toHaveAttribute("data-store", "steam");
  });

  it("names no store when neither knows one", () => {
    render(<GameCard game={skyrim} section="detected" />);

    expect(screen.getByTestId("game-tile")).not.toHaveAttribute("data-store");
  });
});
