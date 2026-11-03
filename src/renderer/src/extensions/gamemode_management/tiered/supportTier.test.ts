import { describe, expect, it, vi } from "vitest";

vi.mock("../../nexus_integration/util", () => ({
  numericGameIdToDomainName: (id: number) =>
    ({ 1704: "skyrimspecialedition", 4242: "emberville" })[id],
}));

vi.mock("../../nexus_integration/util/convertGameId", () => ({
  nexusGameId: (game: { id: string; details?: { nexusPageId?: string } }) =>
    game.details?.nexusPageId ?? game.id,
}));

import { GameId } from "@vortex/shared";

import type { IState } from "@/types/IState";

import type { IDetectedGame } from "../types/IDetectedGame";
import { supportTier } from "./supportTier";
import { Tiers } from "./types";

const detected = (gameId: number, withExtension: boolean): IDetectedGame => ({
  gameUid: `uid-${gameId}`,
  gameId: GameId(gameId),
  storeIDs: { steam: [], gog: [], epic: [] },
  extension: withExtension
    ? ({ name: "ext", modId: 1, fileId: 1 } as IDetectedGame["extension"])
    : undefined,
});

const state = (options: {
  tier0?: number[];
  known?: { id: string; details?: { nexusPageId?: string } }[];
  detected?: IDetectedGame[];
  catalog?: { gameId?: number }[];
}): IState =>
  ({
    persistent: {
      gameMode: {
        tier0: Object.fromEntries(
          (options.tier0 ?? []).map((id) => [id, { domain: "emberville" }]),
        ),
      },
    },
    session: {
      gameMode: { known: options.known ?? [], detectedGames: options.detected ?? [] },
      extensions: { available: options.catalog ?? [] },
    },
  }) as unknown as IState;

describe("supportTier", () => {
  it("is Tier 0 for a game managed without an extension", () => {
    expect(supportTier(state({ tier0: [4242] }), GameId(4242))).toBe(Tiers.tier0);
  });

  it("is Tier 0 for an extension-less detected game, whatever the catalog claims", () => {
    // the catalog is not a signal here (it misses bundled ones, too): the endpoint
    // reported no extension for the game, so it has none
    expect(
      supportTier(
        state({ detected: [detected(4242, false)], catalog: [{ gameId: 4242 }] }),
        GameId(4242),
      ),
    ).toBe(Tiers.tier0);
  });

  it("is Tier 2 for a game Vortex knows, even when the endpoint left its extension out", () => {
    // Skyrim SE is bundled: its game is known, the endpoint returns no extension
    expect(
      supportTier(
        state({
          known: [{ id: "skyrimse", details: { nexusPageId: "skyrimspecialedition" } }],
          detected: [detected(1704, false)],
        }),
        GameId(1704),
      ),
    ).toBe(Tiers.tier2);
  });

  it("is Tier 2 for a game the endpoint returned an extension for", () => {
    expect(supportTier(state({ detected: [detected(4242, true)] }), GameId(4242))).toBe(
      Tiers.tier2,
    );
  });

  it("is Tier 2 for a game only the catalog knows", () => {
    expect(supportTier(state({ catalog: [{ gameId: 4242 }] }), GameId(4242))).toBe(Tiers.tier2);
  });

  it("is Tier 0 for a game nothing supports", () => {
    expect(supportTier(state({}), GameId(4242))).toBe(Tiers.tier0);
  });
});
