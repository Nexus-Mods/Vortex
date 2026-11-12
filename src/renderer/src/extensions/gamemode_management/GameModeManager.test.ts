import { GameDomain, GameId, VortexGameId } from "@vortex/shared";
import { describe, it, expect, vi } from "vitest";

import type { IGame } from "@/types/IGame";
import type { IExtensionState } from "@/types/IState";

import { makeExtensionState } from "../../test-utils/builders";
import { setKnownGames } from "./actions/session";
import { GameModeManager } from "./GameModeManager";
import { makeTierZeroGame } from "./tiered/tierZero";
import type { IGameStored } from "./types/IGameStored";

// util/Steam reads paths at import time and there is no ApplicationData here
vi.mock("../../util/getVortexPath", () => ({ default: vi.fn(() => "/tmp") }));

function makeKnownGame(id: string, overrides: Partial<IGame> = {}): IGame {
  return {
    id: VortexGameId(id),
    name: `Game ${id}`,
    queryModPath: () => ".",
    executable: () => "game.exe",
    requiredFiles: [],
    ...overrides,
  } satisfies IGame;
}

function makeTierZeroEntry(domain: string) {
  return {
    gameId: GameId(1234),
    domain: GameDomain(domain),
    name: "Some Game",
    storeIDs: { steam: [], gog: [], epic: [] },
  };
}

function makeManager(
  extensionGames: IGame[],
  extensions: Record<string, IExtensionState> = {},
): {
  manager: GameModeManager;
  dispatched: any[];
} {
  const dispatched: any[] = [];
  // the parts of the state that storing a game reads
  const state = {
    app: { extensions },
    persistent: { gameMode: { tier0: {} } },
    session: { gameMode: { known: [] } },
  };
  const manager = new GameModeManager({} as any, extensionGames, [], () => undefined);
  manager.attachToStore({
    dispatch: (action: any) => dispatched.push(action),
    getState: () => state,
  } as any);
  return { manager, dispatched };
}

function dispatchedKnownGames(dispatched: any[]): IGameStored[] {
  const actions = dispatched.filter((action) => action.type === setKnownGames.getType());
  return actions[actions.length - 1]?.payload ?? [];
}

describe("GameModeManager stored games' Nexus Mods game", () => {
  // dummy Nexus Mods games
  const numericA = GameId(1);
  const domainA = GameDomain("domain-a");

  const extensionPath = "/extensions/game-a";

  it("takes the game the catalog named for the game's installed extension", () => {
    const extension = makeExtensionState({
      path: extensionPath,
      nexus: { gameId: numericA, gameDomain: domainA },
    });
    const { dispatched } = makeManager([makeKnownGame("game-a", { extensionPath })], {
      "ext-a": extension,
    });

    expect(dispatchedKnownGames(dispatched)[0].nexus).toEqual({
      gameId: numericA,
      gameDomain: domainA,
    });
  });

  it("prefers the catalog's game over the domain the game declares", () => {
    const extension = makeExtensionState({
      path: extensionPath,
      nexus: { gameId: numericA, gameDomain: domainA },
    });
    const game = makeKnownGame("game-a", {
      extensionPath,
      details: { nexusPageId: "declared-domain" },
    });
    const { dispatched } = makeManager([game], { "ext-a": extension });

    expect(dispatchedKnownGames(dispatched)[0].nexus).toEqual({
      gameId: numericA,
      gameDomain: domainA,
    });
  });

  it("takes the game an extension is given after the games were stored, once stored again", () => {
    const extension = makeExtensionState({ path: extensionPath });
    const { manager, dispatched } = makeManager([makeKnownGame("game-a", { extensionPath })], {
      "ext-a": extension,
    });
    expect(dispatchedKnownGames(dispatched)[0].nexus).toBeUndefined();

    extension.nexus = { gameId: numericA, gameDomain: domainA };
    manager.dispatchKnownGames();

    expect(dispatchedKnownGames(dispatched)[0].nexus).toEqual({
      gameId: numericA,
      gameDomain: domainA,
    });
  });
});

describe("GameModeManager addGames", () => {
  it("makes the game visible in the registry and the manager snapshot", () => {
    const registry: IGame[] = [makeKnownGame("existing")];
    const { manager } = makeManager(registry);

    const game = makeKnownGame("added");
    manager.addGames([game]);

    expect(manager.games.some((iter) => iter.id === "added")).toBe(true);
    expect(registry.some((iter) => iter.id === "added")).toBe(true);
  });

  it("re-dispatches the known games including the added one", () => {
    const { manager, dispatched } = makeManager([makeKnownGame("existing")]);

    const game = makeTierZeroGame(makeTierZeroEntry("somegame"));
    manager.addGames([game]);

    const known = dispatchedKnownGames(dispatched);
    expect(known.map((iter) => iter.id)).toEqual(["existing", "tier-0-1234"]);
    // the synthesized game passes the validity shape check despite the
    // empty placeholder executable
    expect(known[1].executable).toBe("");
  });

  it("ignores games whose id is already known", () => {
    const registry: IGame[] = [makeKnownGame("existing")];
    const { manager, dispatched } = makeManager(registry);

    manager.addGames([makeKnownGame("existing", { name: "Different Object" })]);

    expect(manager.games).toHaveLength(1);
    expect(manager.games[0].name).not.toBe("Different Object");
    expect(dispatched).toHaveLength(1); // only the attachToStore dispatch
  });

  it("does not dispatch when nothing was added", () => {
    const { manager, dispatched } = makeManager([]);

    manager.addGames([]);

    expect(dispatched).toHaveLength(1);
  });

  it("works before the store is attached without dispatching", () => {
    const manager = new GameModeManager({} as any, [], [], () => undefined);
    expect(() => manager.addGames([makeKnownGame("added")])).not.toThrow();
    expect(manager.games).toHaveLength(1);
  });
});

describe("GameModeManager removeGames", () => {
  it("removes the game from the registry and the manager snapshot", () => {
    const game = makeKnownGame("removable");
    const registry: IGame[] = [makeKnownGame("existing"), game];
    const { manager } = makeManager(registry);

    manager.removeGames([VortexGameId("removable")]);

    expect(manager.games.some((iter) => iter.id === "removable")).toBe(false);
    expect(registry.some((iter) => iter.id === "removable")).toBe(false);
  });

  it("re-dispatches the known games without the removed one", () => {
    const { manager, dispatched } = makeManager([
      makeKnownGame("existing"),
      makeKnownGame("removable"),
    ]);

    manager.removeGames([VortexGameId("removable")]);

    expect(dispatchedKnownGames(dispatched).map((iter) => iter.id)).toEqual(["existing"]);
  });

  it("does not dispatch for unknown domains", () => {
    const { manager, dispatched } = makeManager([makeKnownGame("existing")]);

    manager.removeGames([VortexGameId("unknown")]);

    expect(dispatched).toHaveLength(1);
    expect(manager.games).toHaveLength(1);
  });
});
