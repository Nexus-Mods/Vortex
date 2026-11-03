import { describe, expect, it, vi } from "vitest";

vi.mock("../../../nexus_integration/util", () => ({
  numericGameIdToDomainName: (id: number) => ({ 4242: "emberville", 100: "moddable" })[id],
  nexusGames: () => [{ id: 4242, domain_name: "emberville", name: "Emberville" }],
}));

import { GameDomain, GameId, VortexGameId } from "@vortex/shared";

import type { ITierZeroGame, IState } from "@/types/IState";

import type { IDetectedGame } from "../../types/IDetectedGame";
import { tierZeroEntry } from "./tierZeroEntry";

const detected = (gameId: number, withExtension: boolean): IDetectedGame => ({
  gameUid: `uid-${gameId}`,
  gameId: GameId(gameId),
  storeIDs: { steam: ["42420"], gog: [], epic: [] },
  extension: withExtension
    ? ({ name: "ext", modId: 1, fileId: 1 } as IDetectedGame["extension"])
    : undefined,
});

const state = (options: {
  known?: { id: string }[];
  detected?: IDetectedGame[];
  catalog?: { gameId?: number }[];
}): IState =>
  ({
    session: {
      gameMode: { known: options.known ?? [], detectedGames: options.detected ?? [] },
      extensions: { available: options.catalog ?? [] },
    },
  }) as unknown as IState;

describe("tierZeroEntry", () => {
  it("builds the entry from the store listings the endpoint matched", () => {
    const entry = tierZeroEntry(
      state({ detected: [detected(4242, false)] }),
      VortexGameId("emberville"),
    );

    expect(entry).toEqual({
      gameId: GameId(4242),
      domain: GameDomain("emberville"),
      name: "Emberville",
      storeIDs: { steam: ["42420"], gog: [], epic: [] },
    });
  });

  it("is undefined when Vortex knows the game", () => {
    const entry = tierZeroEntry(
      state({ known: [{ id: "emberville" }], detected: [detected(4242, false)] }),
      VortexGameId("emberville"),
    );

    expect(entry).toBeUndefined();
  });

  it("is undefined when the endpoint returned an extension for the game", () => {
    const entry = tierZeroEntry(
      state({ detected: [detected(4242, true)] }),
      VortexGameId("emberville"),
    );

    expect(entry).toBeUndefined();
  });

  it("is undefined when an extension in the catalog provides support", () => {
    const entry = tierZeroEntry(
      state({ detected: [detected(4242, false)], catalog: [{ gameId: 4242 }] }),
      VortexGameId("emberville"),
    );

    expect(entry).toBeUndefined();
  });

  it("leaves the domain of another unique game alone but degrades the name to the id", () => {
    const entry = tierZeroEntry(
      state({ detected: [detected(100, false)] }),
      VortexGameId("moddable"),
    );

    expect(entry?.name).toBe("moddable");
    expect(entry?.domain).toBe(GameDomain("moddable"));
  });
});
