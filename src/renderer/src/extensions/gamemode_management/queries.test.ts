import type { IGameListEntry } from "@nexusmods/nexus-api";
import { GameDomain, GameId, VortexGameId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import type { IGameStored, ITierZeroGame } from "@/types/IState";

import { makeGameStored } from "../../test-utils/builders";
import { convertId, findGame, type IGameData } from "./queries";
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

/** A known game, declaring the Nexus Mods page it belongs to if it has one. */
const game = (id: VortexGameId, nexusPageId?: GameDomain): IGameStored =>
  makeGameStored({
    id,
    name: id,
    details: nexusPageId === undefined ? undefined : { nexusPageId },
  });

/** Data that knows games with these ids, none of which declares a Nexus Mods page. */
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
    it("finds the game that declares the domain as its nexus page", () => {
      const known = [game(gameA, domainA), game(gameB, domainB)];

      expect(findGame(gameData({ known }), { gameDomain: domainA })?.id).toBe(gameA);
    });

    it("finds a Tier 0 game by the domain it is managed under", () => {
      const known = [game(gameA, domainA), game(tierZeroGame, tierZeroDomain)];

      expect(findGame(gameData({ known }), { gameDomain: tierZeroDomain })?.id).toBe(tierZeroGame);
    });

    it("is undefined when no known game declares the domain", () => {
      const known = [game(gameA, domainA)];

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
      const known = [game(gameA, domainA)];

      expect(findGame(gameData({ known }), { gameDomain: GameDomain("DOMAIN-A") })).toBeUndefined();
    });

    describe("when games share the domain", () => {
      const known = [game(sharedA, sharedDomain), game(sharedB, sharedDomain)];
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
    it("finds an extension game through the domain the games list gives the id", () => {
      const data = gameData({
        known: [game(gameA, domainA), game(gameB, domainB)],
        nexusGames: [listed(numericA, domainA), listed(numericB, domainB)],
      });

      expect(findGame(data, { gameId: numericB })?.id).toBe(gameB);
    });

    it("finds a Tier 0 game through its entry, without the games list", () => {
      const data = gameData({
        known: [game(gameA, domainA), game(tierZeroGame, tierZeroDomain)],
        tier0: { [numericTierZero]: tierZeroEntry(numericTierZero, tierZeroDomain) },
      });

      expect(findGame(data, { gameId: numericTierZero })?.id).toBe(tierZeroGame);
    });

    it("finds the extension game that has taken over a Tier 0 entry's domain", () => {
      const data = gameData({
        known: [game(gameA, domainA)],
        tier0: { [numericTierZero]: tierZeroEntry(numericTierZero, domainA) },
        nexusGames: [listed(numericTierZero, domainA)],
      });

      expect(findGame(data, { gameId: numericTierZero })?.id).toBe(gameA);
    });

    it("is undefined for a Tier 0 entry whose game is not registered and is not listed", () => {
      const data = gameData({
        known: [game(gameA, domainA)],
        tier0: { [numericTierZero]: tierZeroEntry(numericTierZero, tierZeroDomain) },
      });

      expect(findGame(data, { gameId: numericTierZero })).toBeUndefined();
    });

    it("does not take a game registered under a tier-0 id for a Tier 0 game without an entry", () => {
      const data = gameData({ known: [game(tierZeroGame, tierZeroDomain)] });

      expect(findGame(data, { gameId: numericTierZero })).toBeUndefined();
    });

    it("is undefined when the games list does not have the id", () => {
      const data = gameData({
        known: [game(gameA, domainA)],
        nexusGames: [listed(numericA, domainA)],
      });

      expect(findGame(data, { gameId: numericB })).toBeUndefined();
    });

    it("is undefined when no known game declares the listed domain", () => {
      const data = gameData({
        known: [game(gameB, domainB)],
        nexusGames: [listed(numericA, domainA)],
      });

      expect(findGame(data, { gameId: numericA })).toBeUndefined();
    });

    it("does not find a game by an id that happens to equal the listed domain", () => {
      const data = gameData({
        known: [game(VortexGameId("domain-a"))],
        nexusGames: [listed(numericA, domainA)],
      });

      expect(findGame(data, { gameId: numericA })).toBeUndefined();
    });

    it("is undefined when nothing is known", () => {
      expect(findGame(gameData(), { gameId: numericA })).toBeUndefined();
    });

    describe("when games share the id's domain", () => {
      const data = gameData({
        known: [game(sharedA, sharedDomain), game(sharedB, sharedDomain)],
        nexusGames: [listed(numericShared, sharedDomain)],
      });

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
    known: [game(gameA, domainA), game(gameB, domainB)],
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
    it("converts a vortexGameId to the nexus page the game declares", () => {
      expect(convertId(data, { vortexGameId: gameB }, "gameDomain")).toBe(domainB);
    });

    it("is undefined for a game that declares no nexus page, whatever its id", () => {
      const noPage = gameData({ known: [game(VortexGameId("domain-a"))] });

      expect(
        convertId(noPage, { vortexGameId: VortexGameId("domain-a") }, "gameDomain"),
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
});
