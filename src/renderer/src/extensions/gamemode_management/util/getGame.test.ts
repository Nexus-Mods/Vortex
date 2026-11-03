import { afterEach, describe, expect, it } from "vitest";

import type { IExtensionDownloadInfo } from "../../../types/extensions";
import type { IGame } from "../../../types/IGame";
import local from "../../../util/local";
import type { IGameStub } from "../GameModeManager";
import { getGame, isGameRegistered } from "./getGame";

const registry = local<{
  gameModeManager: unknown;
  extensionGames: IGame[];
  extensionStubs: IGameStub[];
}>("gamemode-management", {
  gameModeManager: undefined,
  extensionGames: [],
  extensionStubs: [],
});

const makeGame = (id: string): IGame => ({ id, name: id }) as unknown as IGame;

describe("isGameRegistered", () => {
  afterEach(() => {
    registry.extensionGames.length = 0;
    registry.extensionStubs.length = 0;
  });

  it("is true for a game a game extension registered", () => {
    registry.extensionGames.push(makeGame("skyrimse"));

    expect(isGameRegistered("skyrimse")).toBe(true);
  });

  it("is false for a stub, which getGame still returns", () => {
    registry.extensionStubs.push({
      game: makeGame("mountandblade2bannerlord"),
      ext: { name: "Bannerlord support", modId: 875 } as IExtensionDownloadInfo,
    });

    expect(getGame("mountandblade2bannerlord")).toBeDefined();
    expect(isGameRegistered("mountandblade2bannerlord")).toBe(false);
  });

  it("is false for an unknown game", () => {
    expect(isGameRegistered("unknown")).toBe(false);
  });
});
