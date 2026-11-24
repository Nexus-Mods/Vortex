import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type * as ReactReduxTypes from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IGameStored } from "../types/IGameStored";

const { cardActions, emit, state } = vi.hoisted(() => ({
  cardActions: {
    primary: undefined as { label: string; onClick: () => void } | undefined,
    onMenuAction: undefined as ((action: string) => void) | undefined,
  },
  emit: vi.fn<(...args: unknown[]) => void>(),
  state: {
    current: {
      persistent: { profiles: {} as Record<string, { gameId: string }> },
      settings: {
        gameMode: { discovered: {} },
        profiles: { activeProfileId: undefined as string | undefined },
      },
    },
  },
}));

vi.mock("@/contexts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useMainContext: () => ({ api: { events: { emit } } }),
}));

vi.mock("react-redux", async () => {
  const actual = await vi.importActual<typeof ReactReduxTypes>("react-redux");

  return {
    ...actual,
    useSelector: (selector: (input: unknown) => unknown) => selector(state.current),
  };
});

// Hands the card whatever lead action the test set, and keeps the menu callback the card
// passed so a test can play a menu row being run.
vi.mock("../hooks/use_game_card_actions/useGameCardActions.hook", () => ({
  useGameCardActions: (...args: unknown[]) => {
    cardActions.onMenuAction = args[4] as (action: string) => void;
    return { menu: [], primary: cardActions.primary };
  },
}));

vi.mock("@/extensions/analytics/mixpanel/numericGameId", () => ({
  numericNexusGameId: () => 1704,
}));

// The art resolves through the Nexus games list, which this file has no need of.
vi.mock("../util/gameArtURL", () => ({ gameArtURL: () => undefined }));

// How each store reads on the pill is GameTile's to test; this file checks which store
// the card hands the tile.
vi.mock("@/ui/components/game_tile/GameTile", () => ({
  GameTile: ({ primaryAction, store }: { primaryAction?: React.ReactNode; store?: string }) => (
    <div data-store={store} data-testid="game-tile">
      {primaryAction}
    </div>
  ),
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
    state.current.persistent.profiles = {};
    state.current.settings.profiles.activeProfileId = undefined;
    cardActions.primary = undefined;
    emit.mockReset();
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

  describe("tracking", () => {
    const tracked = () =>
      emit.mock.calls
        .filter(([event]) => event === "analytics-track-mixpanel-event")
        .map(([, payload]) => payload);

    const leadCases = [
      ["detected", "Add game", "add_game"],
      ["supported", "Manual add", "manual_add"],
      ["added", "Open", "open"],
    ] as const;

    for (const [section, label, action] of leadCases) {
      it(`reports the ${section} tile's lead action as ${action}`, async () => {
        const onClick = vi.fn();
        cardActions.primary = { label: "Manage", onClick };
        state.current.settings.gameMode.discovered = { skyrimse: { store: "gog" } };
        render(<GameCard game={skyrim} section={section} />);

        await userEvent.click(screen.getByRole("button", { name: label }));

        expect(onClick).toHaveBeenCalledOnce();
        expect(tracked()).toEqual([
          {
            eventName: "app_game_tile_action_clicked",
            properties: {
              section,
              layout: "grid",
              placement: "primary",
              action,
              game_id: 1704,
              game_store: "gog",
            },
          },
        ]);
      });
    }

    it("reports the game in play opening its mods instead", async () => {
      state.current.persistent.profiles = { p1: { gameId: "skyrimse" } };
      state.current.settings.profiles.activeProfileId = "p1";
      render(<GameCard game={skyrim} section="added" />);

      await userEvent.click(screen.getByRole("button", { name: "Open" }));

      expect(emit).toHaveBeenCalledWith("show-main-page", "Mods");
      expect(tracked()).toEqual([
        expect.objectContaining({
          properties: expect.objectContaining({ placement: "primary", action: "open_mods" }),
        }),
      ]);
    });

    it("reports a menu row with the key the menu named it by", () => {
      render(<GameCard detectedStore="steam" game={skyrim} section="detected" />);

      cardActions.onMenuAction?.("Stop Managing");

      expect(tracked()).toEqual([
        {
          eventName: "app_game_tile_action_clicked",
          properties: {
            section: "detected",
            layout: "grid",
            placement: "menu",
            action: "Stop Managing",
            game_id: 1704,
            game_store: "steam",
          },
        },
      ]);
    });

    it("sends a null game_store when nothing names the store", () => {
      render(<GameCard game={skyrim} section="supported" />);

      cardActions.onMenuAction?.("game_details");

      expect(tracked()[0]).toEqual(
        expect.objectContaining({
          properties: expect.objectContaining({ game_store: null }),
        }),
      );
    });
  });
});
