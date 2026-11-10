import { GameDomain, GameId } from "@vortex/shared";
import { assert, describe, it, expect, afterEach } from "vitest";

import type { IGame } from "@/types/IGame";
import type { IGameStore } from "@/types/IGameStore";
import type { IGameStoreEntry } from "@/types/IGameStoreEntry";
import type { ITierZeroGame } from "@/types/IState";
import local from "@/util/local";

import {
  epicAppNames,
  isTierZeroGame,
  makeTierZeroGame,
  synthesizePersistedTierZeroGames,
  unregisterTierZeroGame,
} from "./tierZero";

const $ = local<{ gameModeManager: { gameStores: IGameStore[] } | undefined }>(
  "gamemode-management",
  { gameModeManager: undefined },
);

function makeEntry(overrides: Partial<ITierZeroGame> = {}): ITierZeroGame {
  return {
    gameId: GameId(1234),
    domain: GameDomain("somegame"),
    name: "Some Game",
    storeIDs: { steam: [], gog: [], epic: [] },
    ...overrides,
  };
}

function makeKnownGame(id: string, overrides: Partial<IGame> = {}): IGame {
  return {
    id,
    name: "Known Game",
    queryModPath: () => ".",
    executable: () => "game.exe",
    requiredFiles: [],
    ...overrides,
  } satisfies IGame;
}

function makeStoreEntry(
  overrides: Partial<IGameStoreEntry & { catalogNamespace: string; catalogItemId: string }>,
): IGameStoreEntry {
  return {
    appid: "app-1",
    name: "Some Game",
    gamePath: "C:\\Games\\SomeGame",
    gameStoreId: "steam",
    ...overrides,
  };
}

function makeStore(id: string, entries: IGameStoreEntry[]): IGameStore {
  return {
    id,
    snapshot: () => ({ entries, isInstalled: true }),
  } as unknown as IGameStore;
}

afterEach(() => {
  $.gameModeManager = undefined;
  // the provenance set is module-level; drop what a test registered so the
  // next test starts clean
  unregisterTierZeroGame(GameId(1234));
});

describe("makeTierZeroGame", () => {
  it("synthesizes the game shape for the entry", () => {
    const game = makeTierZeroGame(makeEntry());
    assert(game);

    expect(game.id).toBe("somegame");
    expect(game.name).toBe("Some Game");
    expect(game.queryModPath("C:\\Games\\SomeGame")).toBe(".");
    expect(game.requiredFiles).toEqual([]);
    expect(game.executable("C:\\Games\\SomeGame")).toBe("");
  });

  it("resolves the installed version to unknown, never rejecting", async () => {
    const game = makeTierZeroGame(makeEntry());
    await expect(game.getInstalledVersion({})).resolves.toBe("unknown");
  });

  it("resolves the game version override to unknown", async () => {
    const game = makeTierZeroGame(makeEntry());
    await expect(game.getGameVersion("C:\\Games\\SomeGame", "")).resolves.toBe("unknown");
  });

  it("toggles provenance via unregister", () => {
    const game = makeTierZeroGame(makeEntry());
    expect(game).toBeDefined();
    expect(isTierZeroGame(GameId(1234))).toBe(true);
    unregisterTierZeroGame(GameId(1234));
    expect(isTierZeroGame(GameId(1234))).toBe(false);
  });
});

describe("makeTierZeroGame queryArgs", () => {
  it("passes steam and gog ids through", () => {
    const game = makeTierZeroGame(
      makeEntry({ storeIDs: { steam: ["638970"], gog: ["1207658"], epic: [] } }),
    );

    expect(game.queryArgs).toEqual({
      steam: [{ id: "638970" }],
      gog: [{ id: "1207658" }],
    });
  });

  it("omits stores without ids", () => {
    const game = makeTierZeroGame(makeEntry());
    expect(game.queryArgs).toEqual({});
  });

  it("translates epic catalog listings against the store snapshot", () => {
    $.gameModeManager = {
      gameStores: [
        makeStore("epic", [
          makeStoreEntry({
            gameStoreId: "epic",
            appid: "Ginger",
            catalogNamespace: "ns1",
            catalogItemId: "item1",
          }),
        ]),
      ],
    };

    const entry = makeEntry({ storeIDs: { steam: [], gog: [], epic: ["ns1:item1"] } });
    const game = makeTierZeroGame(entry);

    expect(game.queryArgs.epic).toEqual([{ id: "Ginger" }, { name: "Some Game" }]);
    expect(epicAppNames(entry)).toEqual(["Ginger"]);
  });

  it("falls back to the exact display name for unmatched epic listings", () => {
    $.gameModeManager = {
      gameStores: [
        makeStore("epic", [
          makeStoreEntry({ gameStoreId: "epic", appid: "Ginger", name: "Some Game" }),
        ]),
      ],
    };
    const entry = makeEntry({ storeIDs: { steam: [], gog: [], epic: ["nsX:itemX"] } });
    const game = makeTierZeroGame(entry);
    expect(epicAppNames(entry)).toEqual(["Ginger"]);
    expect(game.queryArgs.epic).toEqual([{ id: "Ginger" }, { name: "Some Game" }]);
  });

  it("re-evaluates epic ids on every access", () => {
    const game = makeTierZeroGame(
      makeEntry({ storeIDs: { steam: [], gog: [], epic: ["ns1:item1"] } }),
    );
    // snapshot not loaded yet: only the name fallback
    expect(game.queryArgs.epic).toEqual([{ name: "Some Game" }]);

    $.gameModeManager = {
      gameStores: [
        makeStore("epic", [
          makeStoreEntry({
            gameStoreId: "epic",
            appid: "Ginger",
            catalogNamespace: "ns1",
            catalogItemId: "item1",
          }),
        ]),
      ],
    };

    expect(game.queryArgs.epic).toEqual([{ id: "Ginger" }, { name: "Some Game" }]);
  });
});

describe("makeTierZeroGame requiresLauncher", () => {
  it("returns the steam payload for the recorded listing", async () => {
    const game = makeTierZeroGame(
      makeEntry({ storeIDs: { steam: ["638970"], gog: [], epic: [] } }),
    );

    await expect(game.requiresLauncher("C:\\Games\\SomeGame", "steam")).resolves.toEqual({
      launcher: "steam",
      addInfo: "638970",
    });
  });

  it("returns the gog payload for the recorded listing", async () => {
    const game = makeTierZeroGame(
      makeEntry({ storeIDs: { steam: [], gog: ["1207658"], epic: [] } }),
    );

    await expect(game.requiresLauncher("C:\\Games\\SomeGame", "gog")).resolves.toEqual({
      launcher: "gog",
      addInfo: "1207658",
    });
  });

  it("returns the translated epic AppName as payload", async () => {
    $.gameModeManager = {
      gameStores: [
        makeStore("epic", [
          makeStoreEntry({
            gameStoreId: "epic",
            appid: "Ginger",
            catalogNamespace: "ns1",
            catalogItemId: "item1",
          }),
        ]),
      ],
    };

    const game = makeTierZeroGame(
      makeEntry({ storeIDs: { steam: [], gog: [], epic: ["ns1:item1"] } }),
    );

    await expect(game.requiresLauncher("C:\\Games\\SomeGame", "epic")).resolves.toEqual({
      launcher: "epic",
      addInfo: "Ginger",
    });
  });

  it("picks the listing matching the discovered install when several are recorded", async () => {
    $.gameModeManager = {
      gameStores: [
        makeStore("steam", [
          makeStoreEntry({ appid: "111", gamePath: "C:\\Games\\EditionOne" }),
          makeStoreEntry({ appid: "222", gamePath: "C:\\Games\\EditionTwo" }),
        ]),
      ],
    };

    const game = makeTierZeroGame(
      makeEntry({ storeIDs: { steam: ["111", "222"], gog: [], epic: [] } }),
    );

    await expect(game.requiresLauncher("C:\\Games\\EditionTwo\\", "steam")).resolves.toEqual({
      launcher: "steam",
      addInfo: "222",
    });
  });

  it("resolves undefined for games not recorded through a supported store", async () => {
    const game = makeTierZeroGame(makeEntry());
    await expect(game.requiresLauncher("C:\\Games\\SomeGame", undefined)).resolves.toBeUndefined();
    await expect(game.requiresLauncher("C:\\Games\\SomeGame", "xbox")).resolves.toBeUndefined();
  });
});

describe("synthesizePersistedTierZeroGames", () => {
  afterEach(() => {
    unregisterTierZeroGame(GameId(2345));
    unregisterTierZeroGame(GameId(3456));
  });

  it("registers one game per entry in a single addGames call", () => {
    const added: IGame[][] = [];
    synthesizePersistedTierZeroGames(
      {
        [GameId(1234)]: makeEntry(),
        [GameId(2345)]: makeEntry({ gameId: GameId(2345), domain: GameDomain("othergame") }),
      },
      [],
      (games) => added.push(games),
    );

    expect(added).toHaveLength(1);
    expect(added[0].map((game) => game.id)).toEqual(["somegame", "othergame"]);
  });

  it("skips domains owned by a loaded extension game", () => {
    const added: IGame[][] = [];
    synthesizePersistedTierZeroGames(
      { [GameId(1234)]: makeEntry() },
      [makeKnownGame("somegame")],
      (games) => added.push(games),
    );

    expect(added).toHaveLength(0);
    expect(isTierZeroGame(GameId(1234))).toBe(false);
  });

  it("skips domains owned via the extension's nexusPageId", () => {
    const added: IGame[][] = [];
    synthesizePersistedTierZeroGames(
      { [GameId(1234)]: makeEntry() },
      [makeKnownGame("othergame", { details: { nexusPageId: "somegame" } })],
      (games) => added.push(games),
    );

    expect(added).toHaveLength(0);
    expect(isTierZeroGame(GameId(1234))).toBe(false);
  });

  it("skips a second entry whose domain an earlier entry of the pass claimed", () => {
    const added: IGame[][] = [];
    synthesizePersistedTierZeroGames(
      {
        [GameId(1234)]: makeEntry(),
        [GameId(2345)]: makeEntry({ gameId: GameId(2345) }),
      },
      [],
      (games) => added.push(games),
    );

    expect(added).toHaveLength(1);
    expect(added[0]).toHaveLength(1);
    expect(added[0][0].id).toBe("somegame");
    expect(isTierZeroGame(GameId(2345))).toBe(false);
  });

  it("does not call addGames for an empty map", () => {
    let called = false;
    synthesizePersistedTierZeroGames({}, [], () => {
      called = true;
    });
    expect(called).toBe(false);
  });
});
