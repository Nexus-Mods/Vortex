import { GameDomain, GameId } from "@vortex/shared";
import { describe, it, expect } from "vitest";

import type { ITierZeroGame, IStateGameMode } from "@/types/IState";

import { persistentReducer } from "./persistent";

function makeEntry(overrides: Partial<ITierZeroGame> = {}): ITierZeroGame {
  return {
    gameId: GameId(1234),
    domain: GameDomain("somegame"),
    name: "Some Game",
    storeIDs: { steam: ["123"], gog: [], epic: [] },
    ...overrides,
  };
}

function makeState(entries: Record<number, ITierZeroGame>): IStateGameMode {
  const tier0: IStateGameMode["tier0"] = {};
  for (const [key, entry] of Object.entries(entries)) {
    tier0[GameId(Number(key))] = entry;
  }
  return { gameInfo: {}, tier0 };
}

function getEntry(state: IStateGameMode, gameId: number): ITierZeroGame | undefined {
  return state.tier0[GameId(gameId)];
}

describe("setTierZeroGame", () => {
  it("adds the entry under its game id", () => {
    const result = persistentReducer.reducers.SET_TIER_ZERO_GAME(makeState({}), {
      gameId: GameId(1234),
      entry: makeEntry(),
    });
    expect(getEntry(result, 1234)).toEqual(makeEntry());
    expect(result.gameInfo).toEqual({});
  });

  it("overwrites an existing entry for the same game id", () => {
    const state = makeState({ 1234: makeEntry() });
    const result = persistentReducer.reducers.SET_TIER_ZERO_GAME(state, {
      gameId: GameId(1234),
      entry: makeEntry({ name: "Renamed" }),
    });
    expect(getEntry(result, 1234)?.name).toBe("Renamed");
  });
});

describe("removeTierZeroGame", () => {
  it("removes the entry", () => {
    const state = makeState({
      1234: makeEntry(),
      2345: makeEntry({ gameId: GameId(2345), domain: GameDomain("othergame") }),
    });
    const result = persistentReducer.reducers.REMOVE_TIER_ZERO_GAME(state, {
      gameId: GameId(1234),
    });
    expect(Object.keys(result.tier0)).toEqual(["2345"]);
  });

  it("leaves state untouched when the game id is unknown", () => {
    const state = makeState({ 1234: makeEntry() });
    const result = persistentReducer.reducers.REMOVE_TIER_ZERO_GAME(state, {
      gameId: GameId(9999),
    });
    expect(result).toBe(state);
  });
});
