import { describe, expect, it, vi } from "vitest";

// Nexus game ids as the games list resolves them: 1704 is Skyrim SE, 102 Shadowrun Returns.
vi.mock("../../../nexus_integration/util", () => ({
  numericGameIdToDomainName: (id: number) =>
    ({ 1704: "skyrimspecialedition", 102: "shadowrunreturns" })[id],
}));

import type { IGameStored } from "@/types/IState";

import type { IDetectedGame } from "../../types/IDetectedGame";
import { isListableDetectedGame, listableDetectedIds } from "./listableDetectedIds";

const detected = (gameId: number, withExtension: boolean): IDetectedGame => ({
  gameUid: `uid-${gameId}`,
  gameId,
  storeIDs: { steam: [], gog: [], epic: [] },
  extension: withExtension
    ? ({ name: "ext", modId: 1, fileId: 1 } as IDetectedGame["extension"])
    : undefined,
});

// Skyrim SE's nexus page id differs from its internal id, as it does in the real game list.
const known = [
  { id: "skyrimse", details: { nexusPageId: "skyrimspecialedition" } },
  { id: "shadowrunreturns" },
] as unknown as IGameStored[];

describe("isListableDetectedGame", () => {
  it("lists a game the endpoint returned an extension for", () => {
    expect(isListableDetectedGame(detected(5, true), "unknowngame", [])).toBe(true);
  });

  it("lists a game with no extension when Vortex already knows it", () => {
    expect(isListableDetectedGame(detected(102, false), "shadowrunreturns", known)).toBe(true);
  });

  it("hides a game with no extension that Vortex doesn't know", () => {
    expect(isListableDetectedGame(detected(5, false), "unknowngame", known)).toBe(false);
  });
});

describe("listableDetectedIds", () => {
  it("includes bundled games, whose extension the endpoint leaves out", () => {
    const ids = listableDetectedIds([detected(1704, false), detected(102, false)], known);

    expect(ids).toEqual(["uid-1704", "uid-102"]);
  });

  it("includes games with an extension even when Vortex doesn't know them yet", () => {
    expect(listableDetectedIds([detected(5, true)], known)).toEqual(["uid-5"]);
  });

  it("leaves out games with no extension that nothing in Vortex handles", () => {
    expect(listableDetectedIds([detected(5, false)], known)).toEqual([]);
  });

  it("leaves out games with no extension without known games to check", () => {
    expect(listableDetectedIds([detected(102, false)])).toEqual([]);
  });
});
