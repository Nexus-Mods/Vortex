import type { IGameListEntry } from "@nexusmods/nexus-api";
import { GameDomain, GameId, VortexGameId } from "@vortex/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { nexusGames } = vi.hoisted(() => ({ nexusGames: vi.fn(() => [] as IGameListEntry[]) }));
vi.mock("../nexus_integration/util", () => ({ nexusGames }));

import type { IGameStored, IState, ITierZeroGame } from "@/types/IState";

import { makeGameStored } from "../../test-utils/builders";
import { gameData } from "./gameData";

const known: IGameStored[] = [makeGameStored({ id: VortexGameId("game-a"), name: "game-a" })];
const tier0: Record<GameId, ITierZeroGame> = {
  [GameId(1001)]: {
    gameId: GameId(1001),
    domain: GameDomain("tier-zero-domain"),
    name: "tier-zero-game",
    storeIDs: { steam: [], gog: [], epic: [] },
  },
};
const games = [{ id: 1, domain_name: "domain-a" }] as IGameListEntry[];

const state = (overrides: { known?: IGameStored[]; tier0?: Record<GameId, ITierZeroGame> } = {}) =>
  ({
    session: { gameMode: { known: overrides.known ?? known } },
    persistent: { gameMode: { tier0: overrides.tier0 ?? tier0 } },
  }) as unknown as IState;

describe("gameData", () => {
  beforeEach(() => {
    nexusGames.mockReturnValue(games);
  });

  it("collects the known games, the Tier 0 entries and the games list", () => {
    expect(gameData(state())).toEqual({ known, tier0, nexusGames: games });
  });

  it("is the same object while none of the three is replaced", () => {
    // a new state object holding the same slices, as after an unrelated change
    expect(gameData(state())).toBe(gameData(state()));
  });

  it("is replaced when the known games are", () => {
    const before = gameData(state());

    expect(gameData(state({ known: [...known] }))).not.toBe(before);
  });

  it("is replaced when the Tier 0 entries are", () => {
    const before = gameData(state());

    expect(gameData(state({ tier0: { ...tier0 } }))).not.toBe(before);
  });

  it("is replaced when the games list is", () => {
    const before = gameData(state());
    nexusGames.mockReturnValue([...games]);

    expect(gameData(state())).not.toBe(before);
  });
});
