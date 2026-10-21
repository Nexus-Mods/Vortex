import { describe, expect, it } from "vitest";

import type { IGameStored } from "@/types/IState";

import type { IDiscoveryResult } from "../../types/IDiscoveryResult";
import { locallyDetectedGames } from "./locallyDetectedGames";

const game = (id: string): IGameStored => ({
  id,
  name: id,
  executable: undefined,
  extensionPath: undefined,
  requiredFiles: [],
});

// Emberville stands in for an extension still in development: Nexus Mods doesn't list its
// game, so the detected-games response never names it and only discovery finds it.
const known = [game("emberville"), game("skyrimse"), game("witcher3")];

const found: { [gameId: string]: IDiscoveryResult } = {
  emberville: { path: "C:/Games/Emberville", store: "steam" },
  skyrimse: { path: "C:/Games/Skyrim Special Edition", store: "steam" },
};

const hiddenEmberville = { ...found, emberville: { ...found.emberville, hidden: true } };

const ids = (games: IGameStored[]) => games.map((iter) => iter.id);

describe("locallyDetectedGames", () => {
  // No listed ids is also what the page passes while logged out, when the response is empty.
  it("lists every known game discovery found that hasn't been added", () => {
    const games = locallyDetectedGames(known, found, { addedGameIds: new Set() });

    expect(ids(games)).toEqual(["emberville", "skyrimse"]);
  });

  it("leaves out a known game whose discovery has no path", () => {
    const discovered = { ...found, witcher3: { hidden: false } };

    const games = locallyDetectedGames(known, discovered, { addedGameIds: new Set() });

    expect(ids(games)).toEqual(["emberville", "skyrimse"]);
  });

  it("leaves out a game the user has added", () => {
    const games = locallyDetectedGames(known, found, { addedGameIds: new Set(["skyrimse"]) });

    expect(ids(games)).toEqual(["emberville"]);
  });

  it("leaves out a game the detected-games response already listed", () => {
    const games = locallyDetectedGames(known, found, {
      addedGameIds: new Set(),
      listedIds: new Set(["skyrimse"]),
    });

    expect(ids(games)).toEqual(["emberville"]);
  });

  it("leaves out a game the user hid", () => {
    const games = locallyDetectedGames(known, hiddenEmberville, { addedGameIds: new Set() });

    expect(ids(games)).toEqual(["skyrimse"]);
  });

  it("keeps a hidden game when hidden games are shown", () => {
    const games = locallyDetectedGames(known, hiddenEmberville, {
      addedGameIds: new Set(),
      includeHidden: true,
    });

    expect(ids(games)).toEqual(["emberville", "skyrimse"]);
  });
});
