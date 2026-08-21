import { expect, it, describe, vi, beforeEach } from "vitest";

import { IDiscoveryResult, IGameStored } from "@/types/api";

import { getSteamMedia } from "../sources/steam";
import sourcesByDiscovery from "./sourcesByDiscovery";

vi.mock("../sources/steam", () => ({
  getSteamMedia: vi.fn(async () => ({ "steam-screenshots-1": {} })),
}));

const exampleGame: IGameStored = {
  id: "test",
  name: "testGame",
  requiredFiles: [],
  executable: "game.exe",
  details: {
    mediaFolders: {
      gameMediaSource: {
        name: "Example media",
        path: "/tmp/etc",
      },
    },
  },
};

const exampleDiscovery: IDiscoveryResult = {
  id: "test",
  path: "/tmp/game",
  store: "steam",
};

describe("sourcesByDiscovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes media sources declared by the game extension", async () => {
    const game = { ...exampleGame };

    const discovery = { ...exampleDiscovery };

    const result = await sourcesByDiscovery(game, discovery);

    expect(result["gameMediaSource"]).toBeDefined();
  });

  it("includes media sources declared by the getKnownFolders method", async () => {
    const game = { ...exampleGame, id: "starfield" };

    const discovery = { ...exampleDiscovery, id: "starfield" };

    const result = await sourcesByDiscovery(game, discovery);

    expect(result["starfield-mygames"]).toBeDefined();
  });

  it("includes Steam sources for Steam installs", async () => {
    const game = { ...exampleGame };
    const steamDiscovery = { ...exampleDiscovery, store: "steam" };
    const nonSteamDiscovery = { ...exampleDiscovery, store: "other" };

    const steamResult = await sourcesByDiscovery(game, steamDiscovery);
    const nonSteamResult = await sourcesByDiscovery(game, nonSteamDiscovery);

    expect(getSteamMedia).toHaveBeenCalledOnce();
    expect(steamResult["steam-screenshots-1"]).toBeDefined();
    expect(nonSteamResult["steam-screenshots-1"]).not.toBeDefined();
  });

  it("includes Xbox sources for Xbox installs", async () => {
    const game = { ...exampleGame };
    const xboxDiscovery = { ...exampleDiscovery, store: "xbox" };
    const nonXboxDiscovery = { ...exampleDiscovery, store: "other" };

    const xboxResult = await sourcesByDiscovery(game, xboxDiscovery);
    const nonXboxResult = await sourcesByDiscovery(game, nonXboxDiscovery);

    expect(xboxResult["xbox-default-captures"]).toBeDefined();
    expect(nonXboxResult["xbox-default-captures"]).not.toBeDefined();
  });

  it("empty discovery returns no sources", async () => {
    const game = { ...exampleGame, details: { mediaFolders: {} } };
    const result = await sourcesByDiscovery(game, {});

    expect(result).toEqual({});
    expect(Object.keys(result).length).toEqual(0);
  });
});
