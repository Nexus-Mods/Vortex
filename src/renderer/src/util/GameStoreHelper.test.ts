import Bluebird from "bluebird";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeApiHarness } from "../test-utils/builders";
import { GameEntryNotFound } from "../types/IGameStore";
import type { IGameStore } from "../types/IGameStore";
import type { IGameStoreEntry } from "../types/IGameStoreEntry";
import { GameStoreHelper } from "./GameStoreHelper";

const storesRef = vi.hoisted(() => ({ stores: [] as IGameStore[] }));

vi.mock("winapi-bindings", () => ({
  RegGetValue: () => {
    throw new Error("no registry in tests");
  },
  GetProcessList: () => [],
}));

vi.mock("../extensions/gamemode_management/util/getGame", () => ({
  getGameStores: () => storesRef.stores,
}));

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
    allGames: () => Bluebird.resolve(entries),
    snapshot: () => ({ entries, isInstalled: entries.length > 0 }),
    getGameStorePath: () => Bluebird.resolve(`C:\\${id}\\launcher.exe`),
    launchGame: () => Bluebird.resolve(),
    reloadGames: () => Bluebird.resolve(),
    ...overrides,
  }) as unknown as IGameStore;

const setStores = (stores: IGameStore[]) => {
  storesRef.stores.length = 0;
  storesRef.stores.push(...stores);
};

/** Let the fire-and-forget launch chain run its microtasks. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("GameStoreHelper lookups", () => {
  let helper: GameStoreHelper;

  beforeEach(() => {
    setStores([
      makeStore("steam", [entry("steam", "720", "Steam Game")]),
      makeStore("epic", [entry("epic", "epic-app", "Epic Game")]),
    ]);
    helper = new GameStoreHelper();
  });

  describe("findByAppId", () => {
    it("resolves the entry for a known app id", async () => {
      const res = await helper.findByAppId("720");
      expect(res.appid).toBe("720");
      expect(res.gameStoreId).toBe("steam");
    });

    it("resolves a real Bluebird built from a plain value", () => {
      const prom = helper.findByAppId("720");
      expect(prom).toBeInstanceOf(Bluebird);
      return prom;
    });

    it("rejects GameEntryNotFound on a miss", async () => {
      await expect(helper.findByAppId("99999")).rejects.toThrow(GameEntryNotFound);
    });

    it("rejects GameEntryNotFound for invalid input", async () => {
      await expect(helper.findByAppId([])).rejects.toThrow(GameEntryNotFound);
    });

    it("scopes to the requested store when a store id is given", async () => {
      // "720" only exists in steam; querying the epic store must miss
      await expect(helper.findByAppId("720", "epic")).rejects.toThrow(GameEntryNotFound);
      const res = await helper.findByAppId("720", "steam");
      expect(res.gameStoreId).toBe("steam");
    });

    it("supports array app ids", async () => {
      const res = await helper.findByAppId(["99999", "720"]);
      expect(res.appid).toBe("720");
    });
  });

  describe("findByName", () => {
    it("resolves the entry for an exact name match", async () => {
      const res = await helper.findByName("Epic Game");
      expect(res.gameStoreId).toBe("epic");
    });

    it("does not match on partial names", async () => {
      await expect(helper.findByName("Epic")).rejects.toThrow(GameEntryNotFound);
    });

    it("rejects GameEntryNotFound on a miss", async () => {
      await expect(helper.findByName("No Such Game")).rejects.toThrow(GameEntryNotFound);
    });
  });

  describe("isGameInstalled", () => {
    it("returns the store id on a hit", async () => {
      await expect(helper.isGameInstalled("720")).resolves.toBe("steam");
    });

    it("returns undefined on a miss", async () => {
      await expect(helper.isGameInstalled("99999")).resolves.toBeUndefined();
    });

    it("returns undefined when the game exists in a different store", async () => {
      await expect(helper.isGameInstalled("720", "epic")).resolves.toBeUndefined();
    });
  });

  describe("pre-scan window", () => {
    it("rejects GameEntryNotFound against empty snapshots instead of hanging or scanning", async () => {
      setStores([makeStore("steam", [])]);
      helper = new GameStoreHelper();
      const allGames = vi.spyOn(storesRef.stores[0], "allGames");
      await expect(helper.findByAppId("720")).rejects.toThrow(GameEntryNotFound);
      expect(allGames).not.toHaveBeenCalled();
    });
  });
});

describe("GameStoreHelper.launchGameStore", () => {
  let helper: GameStoreHelper;

  beforeEach(() => {
    setStores([
      makeStore("steam", [entry("steam", "720", "Steam Game")], {
        isGameStoreInstalled: () => Bluebird.resolve(true),
      }),
    ]);
    helper = new GameStoreHelper();
  });

  it("resolves immediately and launches through the store's own launch logic", async () => {
    const launchGameStore = vi.fn(() => Bluebird.resolve());
    const harness = makeApiHarness();
    const api = harness.api;
    setStores([
      makeStore("steam", [], {
        launchGameStore,
        isGameStoreInstalled: () => Bluebird.resolve(true),
      }),
    ]);
    helper = new GameStoreHelper();

    const prom = helper.launchGameStore(api, "steam", ["-arg"]);
    expect(prom).toBeInstanceOf(Bluebird);
    await prom;
    await flush();

    expect(launchGameStore).toHaveBeenCalledWith(api, ["-arg"]);
    expect(harness.dialogCalls).toHaveLength(0);
    expect(harness.errorNotifications).toHaveLength(0);
  });

  it("resolves immediately for an unknown store and reports the failure via notification", async () => {
    const harness = makeApiHarness();
    const api = harness.api;
    await helper.launchGameStore(api, "doesnotexist");
    await flush();

    expect(harness.dialogCalls).toHaveLength(0);
    expect(harness.errorNotifications.length).toBeGreaterThan(0);
  });

  it("reports an uninstalled store via notification and never runs an executable", async () => {
    const harness = makeApiHarness();
    const api = harness.api;
    const runExecutable = vi.fn().mockResolvedValue(undefined);
    api.runExecutable = runExecutable;
    setStores([makeStore("steam", [], { isGameStoreInstalled: () => Bluebird.resolve(false) })]);
    helper = new GameStoreHelper();

    await helper.launchGameStore(api, "steam");
    await flush();

    expect(harness.dialogCalls).toHaveLength(0);
    expect(runExecutable).not.toHaveBeenCalled();
    expect(harness.errorNotifications.length).toBeGreaterThan(0);
  });

  it("runs the store executable when no custom launch logic exists", async () => {
    const harness = makeApiHarness();
    const api = harness.api;
    const runExecutable = vi.fn().mockResolvedValue(undefined);
    api.runExecutable = runExecutable;

    await helper.launchGameStore(api, "steam");
    await flush();

    expect(runExecutable).toHaveBeenCalledWith("C:\\steam\\launcher.exe", [], {
      detach: true,
      suggestDeploy: false,
    });
  });

  it("reports a failing store launch chain via notification only", async () => {
    const harness = makeApiHarness();
    const api = harness.api;
    setStores([
      makeStore("steam", [], {
        launchGameStore: () => Bluebird.reject(new Error("boom")),
        isGameStoreInstalled: () => Bluebird.resolve(true),
      }),
    ]);
    helper = new GameStoreHelper();

    await helper.launchGameStore(api, "steam");
    await flush();

    expect(harness.dialogCalls).toHaveLength(0);
    expect(harness.errorNotifications.length).toBeGreaterThan(0);
  });
});
