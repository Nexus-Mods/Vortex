import { GameUid, NexusGameDomain, NexusGameId } from "@vortex/shared";
import { describe, it, expect, vi } from "vitest";

import { log } from "@/logging";
import type { IGameUidRetirement, ITierZeroGame, IStateGameMode } from "@/types/IState";

import { persistentReducer } from "./persistent";

vi.mock("@/logging", () => ({ log: vi.fn() }));

function makeEntry(overrides: Partial<ITierZeroGame> = {}): ITierZeroGame {
  return {
    gameId: NexusGameId(1234),
    domain: NexusGameDomain("somegame"),
    name: "Some Game",
    storeIDs: { steam: ["123"], gog: [], epic: [] },
    ...overrides,
  };
}

function makeState(entries: Record<number, ITierZeroGame>): IStateGameMode {
  const tier0: IStateGameMode["tier0"] = {};
  for (const [key, entry] of Object.entries(entries)) {
    tier0[NexusGameId(Number(key))] = entry;
  }
  return { gameInfo: {}, gameUidHistory: [], tier0 };
}

function retirement(retired: string, current: string): IGameUidRetirement {
  return { retired: GameUid(retired), current: GameUid(current), recordedAt: 1 };
}

describe("appendGameUidRetirements", () => {
  const append = persistentReducer.reducers.APPEND_GAME_UID_RETIREMENTS;

  it("appends the entry and changes nothing else", () => {
    const before = makeState({ 1234: makeEntry() });
    const result = append(before, { entries: [retirement("x", "y")] });
    expect(result.gameUidHistory).toEqual([retirement("x", "y")]);
    expect(result.tier0).toBe(before.tier0);
    expect(result.gameInfo).toBe(before.gameInfo);
  });

  it("appends after existing entries, oldest first", () => {
    const first = append(makeState({}), { entries: [retirement("x", "y")] });
    const second = append(first, { entries: [retirement("y", "z")] });
    expect(second.gameUidHistory).toEqual([retirement("x", "y"), retirement("y", "z")]);
    expect(first.gameUidHistory).toEqual([retirement("x", "y")]);
  });

  it.each([
    ["maps a uid to itself", retirement("x", "x")],
    ["has an uppercase retired uid", retirement("X", "y")],
    ["has an uppercase current uid", retirement("x", "Y")],
  ])("drops an entry that %s, keeping the history as it was", (_name, entry) => {
    const before = append(makeState({}), { entries: [retirement("a", "b")] });
    vi.mocked(log).mockClear();
    const result = append(before, { entries: [entry] });
    expect(result).toBe(before);
    expect(log).toHaveBeenCalledWith("error", expect.any(String), expect.anything());
  });

  it("keeps the valid entries of a batch", () => {
    const result = append(makeState({}), {
      entries: [retirement("x", "x"), retirement("x", "y")],
    });
    expect(result.gameUidHistory).toEqual([retirement("x", "y")]);
  });
});

function getEntry(state: IStateGameMode, gameId: number): ITierZeroGame | undefined {
  return state.tier0[NexusGameId(gameId)];
}

describe("setTierZeroGame", () => {
  it("adds the entry under its game id", () => {
    const result = persistentReducer.reducers.SET_TIER_ZERO_GAME(makeState({}), {
      gameId: NexusGameId(1234),
      entry: makeEntry(),
    });
    expect(getEntry(result, 1234)).toEqual(makeEntry());
    expect(result.gameInfo).toEqual({});
  });

  it("overwrites an existing entry for the same game id", () => {
    const state = makeState({ 1234: makeEntry() });
    const result = persistentReducer.reducers.SET_TIER_ZERO_GAME(state, {
      gameId: NexusGameId(1234),
      entry: makeEntry({ name: "Renamed" }),
    });
    expect(getEntry(result, 1234)?.name).toBe("Renamed");
  });
});

describe("setManualInstallerPreferences", () => {
  it("sets the preferences on the existing entry", () => {
    const state = makeState({ 1234: makeEntry() });
    const preferences = { defaultFolder: "mods", dontAskAgain: true };
    const result = persistentReducer.reducers.SET_MANUAL_INSTALLER_PREFERENCES(state, {
      gameId: NexusGameId(1234),
      preferences,
    });
    expect(getEntry(result, 1234)).toEqual(makeEntry({ manualInstallerPreferences: preferences }));
  });

  it("leaves state untouched when the game id is unknown", () => {
    const state = makeState({ 1234: makeEntry() });
    const result = persistentReducer.reducers.SET_MANUAL_INSTALLER_PREFERENCES(state, {
      gameId: NexusGameId(9999),
      preferences: { defaultFolder: "mods" },
    });
    expect(result).toBe(state);
  });
});

describe("removeTierZeroGame", () => {
  it("removes the entry", () => {
    const state = makeState({
      1234: makeEntry(),
      2345: makeEntry({ gameId: NexusGameId(2345), domain: NexusGameDomain("othergame") }),
    });
    const result = persistentReducer.reducers.REMOVE_TIER_ZERO_GAME(state, {
      gameId: NexusGameId(1234),
    });
    expect(Object.keys(result.tier0)).toEqual(["2345"]);
  });

  it("leaves state untouched when the game id is unknown", () => {
    const state = makeState({ 1234: makeEntry() });
    const result = persistentReducer.reducers.REMOVE_TIER_ZERO_GAME(state, {
      gameId: NexusGameId(9999),
    });
    expect(result).toBe(state);
  });
});
