import { describe, expect, it, vi } from "vitest";

import type { IState } from "@/types/IState";

// Replaced whole: util and the selectors import each other, so a partial mock leaves the
// selectors holding the real, empty games list.
vi.mock("../../../nexus_integration/util", () => ({
  nexusGames: () => [{ id: 1303, domain_name: "stardewvalley" }],
}));

// Stardew Valley's extension declares no Nexus domain, so its domain is its own id.
vi.mock("../../../gamemode_management/util/getGame", () => ({
  getGame: (id: string) => (id === "stardewvalley" ? { id, details: {} } : undefined),
}));

import { downloadNexusIds } from "./downloadNexusIds";

const IDS = { modId: 55894, fileId: 192243 };

const makeState = (downloads: Record<string, object>) =>
  ({ persistent: { downloads: { files: downloads } } }) as unknown as IState;

describe("downloadNexusIds", () => {
  it("is the Nexus ids the download's record names", () => {
    const state = makeState({
      dl1: { modInfo: { nexus: { ids: { ...IDS, gameId: "stardewvalley" } } } },
    });

    expect(downloadNexusIds(state, "dl1")).toEqual({
      gameDomainName: "stardewvalley",
      numericGameId: 1303,
      modId: "55894",
      fileId: "192243",
      collectionSlug: undefined,
      collectionId: undefined,
      revisionId: undefined,
    });
  });

  it("takes the Nexus game from the game the download is for when the record names none", () => {
    const state = makeState({ dl1: { game: ["stardewvalley"], modInfo: { nexus: { ids: IDS } } } });

    expect(downloadNexusIds(state, "dl1")).toEqual({
      gameDomainName: "stardewvalley",
      numericGameId: 1303,
      modId: "55894",
      fileId: "192243",
      collectionSlug: undefined,
      collectionId: undefined,
      revisionId: undefined,
    });
  });

  it("is undefined when the game the download is for isn't on Nexus Mods", () => {
    const state = makeState({ dl1: { game: ["unknowngame"], modInfo: { nexus: { ids: IDS } } } });

    expect(downloadNexusIds(state, "dl1")).toBeUndefined();
  });

  it("is undefined for a download Vortex has no record of", () => {
    expect(downloadNexusIds(makeState({}), "nope")).toBeUndefined();
  });
});
