import { describe, it, expect } from "vitest";

import type { ITierZeroGame, IStateGameMode } from "../../../../types/IState";
import { persistentReducer } from "./persistent";

function makeEntry(overrides: Partial<ITierZeroGame> = {}): ITierZeroGame {
  return {
    gameId: 1234,
    name: "Some Game",
    storeIDs: { steam: ["123"], gog: [], epic: [] },
    ...overrides,
  };
}

function makeState(tier0: IStateGameMode["tier0"]): IStateGameMode {
  return { gameInfo: {}, tier0 };
}

describe("setTierZeroGame", () => {
  it("adds the entry under its domain", () => {
    const result = persistentReducer.reducers.SET_TIER_ZERO_GAME(makeState({}), {
      domain: "somegame",
      entry: makeEntry(),
    });
    expect(result.tier0.somegame).toEqual(makeEntry());
    expect(result.gameInfo).toEqual({});
  });

  it("overwrites an existing entry for the same domain", () => {
    const state = makeState({ somegame: makeEntry() });
    const result = persistentReducer.reducers.SET_TIER_ZERO_GAME(state, {
      domain: "somegame",
      entry: makeEntry({ name: "Renamed" }),
    });
    expect(result.tier0.somegame.name).toBe("Renamed");
  });
});

describe("removeTierZeroGame", () => {
  it("removes the entry", () => {
    const state = makeState({ somegame: makeEntry(), othergame: makeEntry({ gameId: 2 }) });
    const result = persistentReducer.reducers.REMOVE_TIER_ZERO_GAME(state, {
      domain: "somegame",
    });
    expect(result.tier0).toEqual({ othergame: makeEntry({ gameId: 2 }) });
  });

  it("leaves state untouched when the domain is unknown", () => {
    const state = makeState({ somegame: makeEntry() });
    const result = persistentReducer.reducers.REMOVE_TIER_ZERO_GAME(state, {
      domain: "unknown",
    });
    expect(result).toBe(state);
  });
});
