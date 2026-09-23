import Bluebird from "bluebird";
import { beforeEach, describe, expect, it } from "vitest";

import { makeApiHarness } from "../test-utils/builders";
import { GameEntryNotFound } from "../types/IGameStore";
import type { IGameStore } from "../types/IGameStore";
import type { IGameStoreEntry } from "../types/IGameStoreEntry";
import { GameStoreHelper } from "./GameStoreHelper";

const entry = (gameStoreId: string, appid: string, name: string): IGameStoreEntry => ({
  appid,
  gamePath: `C:\\Games\\${appid}`,
  gameStoreId,
  name,
});

const makeStore = (
  id: string,
  entries: IGameStoreEntry[],
  overrides: Partial<IGameStore> = {},
): IGameStore =>
  ({
    id,
    snapshot: () => ({ entries, isInstalled: entries.length > 0 }),
    getGameStorePath: () => Bluebird.resolve(`C:\\${id}\\launcher.exe`),
    launchGame: () => Bluebird.resolve(),
    reloadGames: () => Bluebird.resolve(),
    ...overrides,
  }) as unknown as IGameStore;

describe("GameStoreHelper unattached", () => {
  let helper: GameStoreHelper;

  beforeEach(() => {
    helper = new GameStoreHelper();
  });

  it("rejects GameEntryNotFound on lookups", async () => {
    await expect(helper.findByAppId("720")).rejects.toThrow(GameEntryNotFound);
    await expect(helper.findByName("Some Game")).rejects.toThrow(GameEntryNotFound);
  });

  it("resolves undefined from isGameInstalled", async () => {
    await expect(helper.isGameInstalled("720")).resolves.toBeUndefined();
  });

  it("reports launch failures via notification and never shows a dialog", async () => {
    const harness = makeApiHarness();
    await helper.launchGameStore(harness.api, "steam");
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(harness.dialogCalls).toHaveLength(0);
    expect(harness.errorNotifications.length).toBeGreaterThan(0);
  });
});

describe("GameStoreHelper attached", () => {
  let helper: GameStoreHelper;
  let stores: IGameStore[];

  beforeEach(() => {
    stores = [makeStore("steam", [entry("steam", "720", "Steam Game")])];
    helper = new GameStoreHelper();
    helper.attach(() => stores);
  });

  it("delegates to the attached store list", async () => {
    const res = await helper.findByAppId("720");
    expect(res.gameStoreId).toBe("steam");
    await expect(helper.isGameInstalled("720")).resolves.toBe("steam");
  });

  it("re-reads the store list on every call, it never caches", async () => {
    stores[0] = makeStore("steam", [entry("steam", "440", "New Game")]);

    await expect(helper.findByAppId("440")).resolves.toBeTruthy();
    await expect(helper.findByAppId("720")).rejects.toThrow(GameEntryNotFound);
  });
});
