import type { IGameListEntry } from "@nexusmods/nexus-api";
import { GameDomain, GameId, VortexGameId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import type { IGameStored, ITierZeroGame } from "@/types/IState";

import { makeGameStored } from "../../test-utils/builders";
import { convertId, findGame, type IGameData, nexusGameData } from "./queries";
import type { IDiscoveryResult } from "./types/IDiscoveryResult";

// Dummy games. A and B are extension games, the tier zero game is managed without an
// extension, and the two shared games are on one Nexus Mods page.
const gameA = VortexGameId("game-a");
const gameB = VortexGameId("game-b");
const tierZeroGame = VortexGameId("tier-0-1001");
const sharedA = VortexGameId("shared-a");
const sharedB = VortexGameId("shared-b");

const domainA = GameDomain("domain-a");
const domainB = GameDomain("domain-b");
const tierZeroDomain = GameDomain("tier-zero-domain");
const sharedDomain = GameDomain("shared-domain");

// The numeric Nexus Mods ids of the dummy games, in the same order.
const numericA = GameId(1);
const numericB = GameId(2);
const numericTierZero = GameId(1001);
const numericShared = GameId(3);

const gameData = (overrides: Partial<IGameData> = {}): IGameData => ({
  known: [],
  tier0: {},
  nexusGames: [],
  ...overrides,
});

// The Nexus Mods game each dummy game is for.
const nexusA = { gameId: numericA, gameDomain: domainA };
const nexusB = { gameId: numericB, gameDomain: domainB };
const nexusTierZero = { gameId: numericTierZero, gameDomain: tierZeroDomain };
const nexusShared = { gameId: numericShared, gameDomain: sharedDomain };

/** A known game, with the Nexus Mods game it is for if it is for one. */
const game = (id: VortexGameId, nexus?: IGameStored["nexus"]): IGameStored =>
  makeGameStored({ id, name: id, nexus });

/** Data that knows games with these ids, none of which is for a Nexus Mods game. */
const knownGames = (...ids: VortexGameId[]): IGameData =>
  gameData({ known: ids.map((id) => game(id)) });

/** Discovery results that found each game on disk. */
const installed = (...ids: VortexGameId[]): Record<VortexGameId, IDiscoveryResult> =>
  Object.fromEntries(ids.map((id) => [id, { path: `C:/Games/${id}` }]));

const listed = (id: GameId, domain: GameDomain): IGameListEntry => ({
  id,
  domain_name: domain,
  name: domain,
  name_lower: domain,
  forum_url: "",
  nexusmods_url: "",
  genre: "",
  mods: 0,
  file_count: 0,
  downloads: 0,
  approved_date: 0,
  collections: 0,
});

const tierZeroEntry = (gameId: GameId, domain: GameDomain): ITierZeroGame => ({
  gameId,
  domain,
  name: domain,
  storeIDs: { steam: [], gog: [], epic: [] },
});

describe("findGame", () => {
  describe("by vortexGameId", () => {
    it("finds the game registered under the id", () => {
      const result = findGame(knownGames(gameA, gameB), { vortexGameId: gameB });

      expect(result?.id).toBe(gameB);
    });

    it("finds a Tier 0 game by its tier-0 id", () => {
      const result = findGame(knownGames(gameA, tierZeroGame), { vortexGameId: tierZeroGame });

      expect(result?.id).toBe(tierZeroGame);
    });

    it("is undefined when no known game has the id", () => {
      expect(findGame(knownGames(gameA), { vortexGameId: gameB })).toBeUndefined();
    });

    it("is undefined when nothing is known", () => {
      expect(findGame(knownGames(), { vortexGameId: gameA })).toBeUndefined();
    });

    it("does not match on the id's case", () => {
      expect(findGame(knownGames(gameA), { vortexGameId: VortexGameId("GAME-A") })).toBeUndefined();
    });
  });

  describe("by gameDomain", () => {
    it("finds the game that is for the domain", () => {
      const known = [game(gameA, nexusA), game(gameB, nexusB)];

      expect(findGame(gameData({ known }), { gameDomain: domainA })?.id).toBe(gameA);
    });

    it("finds a Tier 0 game by the domain it is managed under", () => {
      const known = [game(gameA, nexusA), game(tierZeroGame, nexusTierZero)];

      expect(findGame(gameData({ known }), { gameDomain: tierZeroDomain })?.id).toBe(tierZeroGame);
    });

    it("is undefined when no known game is for the domain", () => {
      const known = [game(gameA, nexusA)];

      expect(findGame(gameData({ known }), { gameDomain: domainB })).toBeUndefined();
    });

    it("is undefined when nothing is known", () => {
      expect(findGame(gameData(), { gameDomain: domainA })).toBeUndefined();
    });

    it("does not find a game by an id that happens to equal the domain", () => {
      const known = [game(VortexGameId("domain-a"))];

      expect(findGame(gameData({ known }), { gameDomain: domainA })).toBeUndefined();
    });

    it("does not match on the domain's case", () => {
      const known = [game(gameA, nexusA)];

      expect(findGame(gameData({ known }), { gameDomain: GameDomain("DOMAIN-A") })).toBeUndefined();
    });

    describe("when games share the domain", () => {
      const known = [game(sharedA, nexusShared), game(sharedB, nexusShared)];
      const gameDomain = sharedDomain;

      it("is the first registered when no discovery results are given", () => {
        expect(findGame(gameData({ known }), { gameDomain })?.id).toBe(sharedA);
      });

      it("is the first registered when none is installed", () => {
        expect(findGame(gameData({ known }), { gameDomain, discovered: {} })?.id).toBe(sharedA);
      });

      it("prefers the installed one", () => {
        const result = findGame(gameData({ known }), {
          gameDomain,
          discovered: installed(sharedB),
        });

        expect(result?.id).toBe(sharedB);
      });

      it("is the first registered of several installed", () => {
        const result = findGame(gameData({ known }), {
          gameDomain,
          discovered: installed(sharedB, sharedA),
        });

        expect(result?.id).toBe(sharedA);
      });

      it("does not count a discovery result without a path as installed", () => {
        const discovered: Record<VortexGameId, IDiscoveryResult> = {
          [sharedB]: { hidden: true },
        };

        expect(findGame(gameData({ known }), { gameDomain, discovered })?.id).toBe(sharedA);
      });
    });
  });

  describe("by gameId", () => {
    it("finds the game that is for the id", () => {
      const data = gameData({ known: [game(gameA, nexusA), game(gameB, nexusB)] });

      expect(findGame(data, { gameId: numericB })?.id).toBe(gameB);
    });

    it("finds a Tier 0 game by the id it is managed under", () => {
      const data = gameData({ known: [game(gameA, nexusA), game(tierZeroGame, nexusTierZero)] });

      expect(findGame(data, { gameId: numericTierZero })?.id).toBe(tierZeroGame);
    });

    it("is undefined when no known game is for the id", () => {
      const data = gameData({ known: [game(gameA, nexusA)] });

      expect(findGame(data, { gameId: numericB })).toBeUndefined();
    });

    it("does not take a game registered under a tier-0 id for a game with that id", () => {
      const data = gameData({ known: [game(tierZeroGame)] });

      expect(findGame(data, { gameId: numericTierZero })).toBeUndefined();
    });

    it("does not look the id up in the games list or the Tier 0 entries", () => {
      const data = gameData({
        known: [game(gameA)],
        tier0: { [numericTierZero]: tierZeroEntry(numericTierZero, domainA) },
        nexusGames: [listed(numericA, domainA)],
      });

      expect(findGame(data, { gameId: numericA })).toBeUndefined();
      expect(findGame(data, { gameId: numericTierZero })).toBeUndefined();
    });

    it("is undefined when nothing is known", () => {
      expect(findGame(gameData(), { gameId: numericA })).toBeUndefined();
    });

    describe("when games are for the same id", () => {
      const data = gameData({ known: [game(sharedA, nexusShared), game(sharedB, nexusShared)] });

      it("is the first registered when none is installed", () => {
        expect(findGame(data, { gameId: numericShared })?.id).toBe(sharedA);
      });

      it("prefers the installed one", () => {
        const result = findGame(data, {
          gameId: numericShared,
          discovered: installed(sharedB),
        });

        expect(result?.id).toBe(sharedB);
      });
    });
  });
});

// converting to a vortexGameId is findGame's lookup, covered above, so only the id it hands
// back is tested. The other targets read the data themselves and are tested in full.
describe("convertId", () => {
  const data = gameData({
    known: [game(gameA, nexusA), game(gameB, nexusB)],
    nexusGames: [listed(numericA, domainA), listed(numericB, domainB)],
  });

  it("converts to the id of the game found", () => {
    expect(convertId(data, { gameDomain: domainB }, "vortexGameId")).toBe(gameB);
    expect(convertId(data, { gameId: numericB }, "vortexGameId")).toBe(gameB);
  });

  it("is undefined when no game is found", () => {
    expect(convertId(data, { gameDomain: tierZeroDomain }, "vortexGameId")).toBeUndefined();
    expect(convertId(data, { gameId: numericTierZero }, "vortexGameId")).toBeUndefined();
  });

  describe("to gameDomain", () => {
    it("converts a vortexGameId to the domain of the game it is for", () => {
      expect(convertId(data, { vortexGameId: gameB }, "gameDomain")).toBe(domainB);
    });

    it("is undefined for a game that is for no Nexus Mods game, whatever its id", () => {
      const noNexus = gameData({ known: [game(VortexGameId("domain-a"))] });

      expect(
        convertId(noNexus, { vortexGameId: VortexGameId("domain-a") }, "gameDomain"),
      ).toBeUndefined();
    });

    it("is undefined for a vortexGameId no known game has", () => {
      expect(convertId(data, { vortexGameId: tierZeroGame }, "gameDomain")).toBeUndefined();
    });

    it("converts a GameId through the games list", () => {
      expect(convertId(data, { gameId: numericB }, "gameDomain")).toBe(domainB);
    });

    it("converts the GameId of a Tier 0 entry without the games list", () => {
      const tierZero = gameData({
        tier0: { [numericTierZero]: tierZeroEntry(numericTierZero, tierZeroDomain) },
      });

      expect(convertId(tierZero, { gameId: numericTierZero }, "gameDomain")).toBe(tierZeroDomain);
    });

    it("prefers the domain a Tier 0 entry is managed under to the games list's", () => {
      const renamed = gameData({
        tier0: { [numericA]: tierZeroEntry(numericA, domainB) },
        nexusGames: [listed(numericA, domainA)],
      });

      expect(convertId(renamed, { gameId: numericA }, "gameDomain")).toBe(domainB);
    });

    it("is undefined for a GameId neither a Tier 0 entry nor the games list has", () => {
      expect(convertId(data, { gameId: numericTierZero }, "gameDomain")).toBeUndefined();
    });
  });

  describe("to gameId", () => {
    it("converts a domain through the games list", () => {
      expect(convertId(data, { gameDomain: domainB }, "gameId")).toBe(numericB);
    });

    it("converts the domain of a Tier 0 entry without the games list", () => {
      const tierZero = gameData({
        tier0: { [numericTierZero]: tierZeroEntry(numericTierZero, tierZeroDomain) },
      });

      expect(convertId(tierZero, { gameDomain: tierZeroDomain }, "gameId")).toBe(numericTierZero);
    });

    it("prefers the GameId a Tier 0 entry is managed under to the games list's", () => {
      const renumbered = gameData({
        tier0: { [numericB]: tierZeroEntry(numericB, domainA) },
        nexusGames: [listed(numericA, domainA)],
      });

      expect(convertId(renumbered, { gameDomain: domainA }, "gameId")).toBe(numericB);
    });

    it("is undefined for a domain neither a Tier 0 entry nor the games list has", () => {
      expect(convertId(data, { gameDomain: tierZeroDomain }, "gameId")).toBeUndefined();
    });

    it("converts a vortexGameId to the id of the game it is for", () => {
      expect(convertId(data, { vortexGameId: gameB }, "gameId")).toBe(numericB);
    });

    it("is undefined for a game that is for no Nexus Mods game, whatever its id", () => {
      const noNexus = gameData({
        known: [game(VortexGameId("domain-a"))],
        nexusGames: [listed(numericA, domainA)],
      });

      expect(
        convertId(noNexus, { vortexGameId: VortexGameId("domain-a") }, "gameId"),
      ).toBeUndefined();
    });
  });
});

describe("nexusGameData", () => {
  it("is the Tier 0 entry's own game for a Tier 0 game", () => {
    const tierZero = gameData({
      tier0: { [numericTierZero]: tierZeroEntry(numericTierZero, tierZeroDomain) },
    });

    expect(nexusGameData(tierZero, tierZeroGame)).toEqual({
      gameId: numericTierZero,
      gameDomain: tierZeroDomain,
    });
  });

  it("prefers the Tier 0 entry over a declared domain", () => {
    const tierZero = gameData({
      tier0: { [numericTierZero]: tierZeroEntry(numericTierZero, tierZeroDomain) },
      nexusGames: [listed(numericA, domainA)],
    });

    expect(nexusGameData(tierZero, tierZeroGame, domainA)).toEqual({
      gameId: numericTierZero,
      gameDomain: tierZeroDomain,
    });
  });

  it("looks the declared domain up in the Nexus Mods games list", () => {
    const data = gameData({ nexusGames: [listed(numericA, domainA), listed(numericB, domainB)] });

    expect(nexusGameData(data, gameB, domainB)).toEqual({
      gameId: numericB,
      gameDomain: domainB,
    });
  });

  it("is undefined when the declared domain isn't in the games list, as before it has loaded", () => {
    expect(nexusGameData(gameData(), gameA, domainA)).toBeUndefined();
  });

  it("is undefined for a game that declares no domain and has no Tier 0 entry", () => {
    expect(
      nexusGameData(gameData({ nexusGames: [listed(numericA, domainA)] }), gameA),
    ).toBeUndefined();
  });

  it("does not take a domain from a game id that happens to equal a listed domain", () => {
    const data = gameData({ nexusGames: [listed(numericA, domainA)] });

    expect(nexusGameData(data, VortexGameId("domain-a"))).toBeUndefined();
  });
});
