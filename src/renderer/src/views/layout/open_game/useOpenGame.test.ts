import { renderHook } from "@testing-library/react";
import { VortexGameId } from "@vortex/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { emit, on, state } = vi.hoisted(() => ({
  emit: vi.fn<(...args: unknown[]) => void>(),
  on: vi.fn<(event: string, listener: (...args: unknown[]) => void) => void>(),
  state: {
    current: {
      persistent: { profiles: {} as Record<string, { gameId: string }> },
      settings: {
        profiles: {
          activeProfileId: undefined as string | undefined,
          nextProfileId: undefined as string | undefined,
        },
      },
    },
  },
}));

vi.mock("@/contexts", () => ({
  useMainContext: () => ({
    api: { events: { emit, on, removeListener: vi.fn() }, getState: () => state.current },
  }),
}));

vi.mock("react-redux", () => ({
  useSelector: (selector: (input: unknown) => unknown) => selector(state.current),
}));

import { useOpenGame } from "./useOpenGame.hook";

const skyrim = VortexGameId("skyrimse");

/** Mounts the layout's answer to "open-game", with helpers to ask and to move the store. */
const renderLayout = () => {
  const { rerender } = renderHook(() => useOpenGame());
  const open = (gameId: VortexGameId, options?: { page?: string }) =>
    on.mock.calls.find(([event]) => event === "open-game")?.[1](gameId, options);
  /** Puts a game in play, or none, as a profile switch does on its way. */
  const play = (gameId?: string) => {
    state.current.settings.profiles.activeProfileId =
      gameId === undefined ? undefined : `${gameId}-profile`;
    // a new object, so selectors that memoise on the state see the change
    state.current = { ...state.current };
    rerender();
  };
  return { open, play };
};

const pagesShown = () => emit.mock.calls.filter(([event]) => event === "show-main-page");
const activations = () => emit.mock.calls.filter(([event]) => event === "activate-game");

describe("useOpenGame", () => {
  beforeEach(() => {
    state.current = {
      persistent: {
        profiles: {
          "skyrimse-profile": { gameId: "skyrimse" },
          "fallout4-profile": { gameId: "fallout4" },
          "oblivion-profile": { gameId: "oblivion" },
        },
      },
      settings: { profiles: { activeProfileId: "fallout4-profile", nextProfileId: undefined } },
    };
    emit.mockReset();
    on.mockReset();
  });

  it("shows the mods of the game already in play", () => {
    const { open } = renderLayout();

    open(VortexGameId("fallout4"));

    expect(pagesShown()).toEqual([["show-main-page", "Mods"]]);
    expect(activations()).toEqual([]);
  });

  // The one click that used to take two: the page follows the switch.
  it("activates a game that isn't in play, then shows its mods once it is", () => {
    const { open, play } = renderLayout();

    open(skyrim);

    expect(activations()).toEqual([["activate-game", "skyrimse"]]);
    expect(pagesShown()).toEqual([]);

    play(undefined);
    expect(pagesShown()).toEqual([]);

    play("skyrimse");
    expect(pagesShown()).toEqual([["show-main-page", "Mods"]]);
  });

  // Adding a game starts the switch to its new profile before it asks.
  it("shows the page asked for once a game that was just added is in play", () => {
    const { open, play } = renderLayout();
    state.current.settings.profiles.nextProfileId = "skyrimse-profile";

    open(skyrim, { page: "Browse" });

    expect(activations()).toEqual([]);

    play("skyrimse");
    expect(pagesShown()).toEqual([["show-main-page", "Browse"]]);
  });

  it("shows nothing when the switch fails and the old game stays in play", () => {
    const { open, play } = renderLayout();

    open(skyrim);
    play("fallout4");

    expect(pagesShown()).toEqual([]);
  });

  it("gives up once another game comes into play", () => {
    const { open, play } = renderLayout();

    open(skyrim);
    play("oblivion");
    play("skyrimse");

    expect(pagesShown()).toEqual([]);
  });
});
