import { GameDomain, VortexGameId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import type { IGameStored } from "@/types/IState";

import { makeGameStored } from "../../test-utils/builders";
import { findGame, type IGameData } from "./queries";
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

const data = (...ids: VortexGameId[]): IGameData => ({
  known: ids.map((id) => makeGameStored({ id, name: id })),
});

describe("findGame", () => {
  describe("by vortexId", () => {
    it("finds the game registered under the id", () => {
      const result = findGame(data(gameA, gameB), { vortexGameId: gameB });

      expect(result?.id).toBe(gameB);
    });

    it("finds a Tier 0 game by its tier-0 id", () => {
      const result = findGame(data(gameA, tierZeroGame), { vortexGameId: tierZeroGame });

      expect(result?.id).toBe(tierZeroGame);
    });

    it("is undefined when no known game has the id", () => {
      expect(findGame(data(gameA), { vortexGameId: gameB })).toBeUndefined();
    });

    it("is undefined when nothing is known", () => {
      expect(findGame(data(), { vortexGameId: gameA })).toBeUndefined();
    });

    it("does not match on the id's case", () => {
      expect(findGame(data(gameA), { vortexGameId: VortexGameId("GAME-A") })).toBeUndefined();
    });
  });

  describe("by gameDomain", () => {
    const game = (id: VortexGameId, nexusPageId?: GameDomain): IGameStored =>
      makeGameStored({
        id,
        name: id,
        details: nexusPageId === undefined ? undefined : { nexusPageId },
      });

    const installed = (...ids: VortexGameId[]): Record<VortexGameId, IDiscoveryResult> =>
      Object.fromEntries(ids.map((id) => [id, { path: `C:/Games/${id}` }]));

    it("finds the game that declares the domain as its nexus page", () => {
      const known = [game(gameA, domainA), game(gameB, domainB)];

      expect(findGame({ known }, { gameDomain: domainA })?.id).toBe(gameA);
    });

    it("finds a Tier 0 game by the domain it is managed under", () => {
      const known = [game(gameA, domainA), game(tierZeroGame, tierZeroDomain)];

      expect(findGame({ known }, { gameDomain: tierZeroDomain })?.id).toBe(tierZeroGame);
    });

    it("is undefined when no known game declares the domain", () => {
      const known = [game(gameA, domainA)];

      expect(findGame({ known }, { gameDomain: domainB })).toBeUndefined();
    });

    it("is undefined when nothing is known", () => {
      expect(findGame({ known: [] }, { gameDomain: domainA })).toBeUndefined();
    });

    it("does not find a game by an id that happens to equal the domain", () => {
      const known = [game(VortexGameId("domain-a"))];

      expect(findGame({ known }, { gameDomain: domainA })).toBeUndefined();
    });

    it("does not match on the domain's case", () => {
      const known = [game(gameA, domainA)];

      expect(findGame({ known }, { gameDomain: GameDomain("DOMAIN-A") })).toBeUndefined();
    });

    describe("when games share the domain", () => {
      const known = [game(sharedA, sharedDomain), game(sharedB, sharedDomain)];
      const gameDomain = sharedDomain;

      it("is the first registered when no discovery results are given", () => {
        expect(findGame({ known }, { gameDomain })?.id).toBe(sharedA);
      });

      it("is the first registered when none is installed", () => {
        expect(findGame({ known }, { gameDomain, discovered: {} })?.id).toBe(sharedA);
      });

      it("prefers the installed one", () => {
        const result = findGame({ known }, { gameDomain, discovered: installed(sharedB) });

        expect(result?.id).toBe(sharedB);
      });

      it("is the first registered of several installed", () => {
        const result = findGame({ known }, { gameDomain, discovered: installed(sharedB, sharedA) });

        expect(result?.id).toBe(sharedA);
      });

      it("does not count a discovery result without a path as installed", () => {
        const discovered: Record<VortexGameId, IDiscoveryResult> = {
          [sharedB]: { hidden: true },
        };

        expect(findGame({ known }, { gameDomain, discovered })?.id).toBe(sharedA);
      });
    });
  });
});
