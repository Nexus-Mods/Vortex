import { GameDomain, VortexGameId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import type { IGameStored } from "@/types/IState";

import { makeGameStored } from "../../test-utils/builders";
import { findGame, type IGameData } from "./queries";
import type { IDiscoveryResult } from "./types/IDiscoveryResult";

const data = (...ids: VortexGameId[]): IGameData => ({
  known: ids.map((id) => makeGameStored({ id, name: id })),
});

describe("findGame", () => {
  describe("by vortexId", () => {
    it("finds the game registered under the id", () => {
      const result = findGame(data(VortexGameId("skyrimse"), VortexGameId("fallout4")), {
        vortexGameId: VortexGameId("fallout4"),
      });

      expect(result?.id).toBe("fallout4");
    });

    it("finds a Tier 0 game by its tier-0 id", () => {
      const result = findGame(data(VortexGameId("skyrimse"), VortexGameId("tier-0-1303")), {
        vortexGameId: VortexGameId("tier-0-1303"),
      });

      expect(result?.id).toBe("tier-0-1303");
    });

    it("is undefined when no known game has the id", () => {
      expect(
        findGame(data(VortexGameId("skyrimse")), { vortexGameId: VortexGameId("fallout4") }),
      ).toBeUndefined();
    });

    it("is undefined when nothing is known", () => {
      expect(findGame(data(), { vortexGameId: VortexGameId("skyrimse") })).toBeUndefined();
    });

    it("does not match on the id's case", () => {
      expect(
        findGame(data(VortexGameId("skyrimse")), { vortexGameId: VortexGameId("SkyrimSE") }),
      ).toBeUndefined();
    });
  });

  describe("by gameDomain", () => {
    const skyrimse = VortexGameId("skyrimse");
    const fallout4 = VortexGameId("fallout4");
    const emberville = VortexGameId("tier-0-1303");
    const nwn = VortexGameId("nwn");
    const nwnee = VortexGameId("nwnee");

    const skyrimDomain = GameDomain("skyrimspecialedition");
    const fallout4Domain = GameDomain("fallout4");
    const embervilleDomain = GameDomain("emberville");
    const neverwinterDomain = GameDomain("neverwinter");

    const game = (id: VortexGameId, nexusPageId?: GameDomain): IGameStored =>
      makeGameStored({
        id,
        name: id,
        details: nexusPageId === undefined ? undefined : { nexusPageId },
      });

    const installed = (...ids: VortexGameId[]): Record<VortexGameId, IDiscoveryResult> =>
      Object.fromEntries(ids.map((id) => [id, { path: `C:/Games/${id}` }]));

    it("finds the game that declares the domain as its nexus page", () => {
      const known = [game(skyrimse, skyrimDomain), game(fallout4, fallout4Domain)];

      expect(findGame({ known }, { gameDomain: skyrimDomain })?.id).toBe(skyrimse);
    });

    it("finds a Tier 0 game by the domain it is managed under", () => {
      const known = [game(skyrimse, skyrimDomain), game(emberville, embervilleDomain)];

      expect(findGame({ known }, { gameDomain: embervilleDomain })?.id).toBe(emberville);
    });

    it("is undefined when no known game declares the domain", () => {
      const known = [game(skyrimse, skyrimDomain)];

      expect(findGame({ known }, { gameDomain: embervilleDomain })).toBeUndefined();
    });

    it("is undefined when nothing is known", () => {
      expect(findGame({ known: [] }, { gameDomain: embervilleDomain })).toBeUndefined();
    });

    it("does not find a game by an id that happens to equal the domain", () => {
      const known = [game(VortexGameId("emberville"))];

      expect(findGame({ known }, { gameDomain: embervilleDomain })).toBeUndefined();
    });

    it("does not match on the domain's case", () => {
      const known = [game(fallout4, fallout4Domain)];

      expect(findGame({ known }, { gameDomain: GameDomain("Fallout4") })).toBeUndefined();
    });

    describe("when games share the domain", () => {
      const known = [game(nwn, neverwinterDomain), game(nwnee, neverwinterDomain)];
      const gameDomain = neverwinterDomain;

      it("is the first registered when no discovery results are given", () => {
        expect(findGame({ known }, { gameDomain })?.id).toBe(nwn);
      });

      it("is the first registered when none is installed", () => {
        expect(findGame({ known }, { gameDomain, discovered: {} })?.id).toBe(nwn);
      });

      it("prefers the installed one", () => {
        const result = findGame({ known }, { gameDomain, discovered: installed(nwnee) });

        expect(result?.id).toBe(nwnee);
      });

      it("is the first registered of several installed", () => {
        const result = findGame({ known }, { gameDomain, discovered: installed(nwnee, nwn) });

        expect(result?.id).toBe(nwn);
      });

      it("does not count a discovery result without a path as installed", () => {
        const discovered: Record<VortexGameId, IDiscoveryResult> = {
          [nwnee]: { hidden: true },
        };

        expect(findGame({ known }, { gameDomain, discovered })?.id).toBe(nwn);
      });
    });
  });
});
