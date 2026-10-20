import { GameDomain, GameId, VortexGameId } from "@vortex/shared";
import { describe, it, expect, vi } from "vitest";

import type { IDiscoveredTool } from "@/types/IDiscoveredTool";
import type { IGame } from "@/types/IGame";

import { makeApiHarness, makeProfile } from "../../test-utils/builders";
import interfaceSettingsReducer from "../starter_dashlet/reducers";
import { setKnownGames } from "./actions/session";
import { GameModeManager } from "./GameModeManager";
import { settingsReducer as gameModeSettingsReducer } from "./reducers/settings/settings";
import { makeTierZeroGame } from "./tiered/tierZero";
import type { IGameStored } from "./types/IGameStored";

// util/Steam reads paths at import time and there is no ApplicationData here
vi.mock("../../util/getVortexPath", () => ({ default: vi.fn(() => "/tmp") }));

function makeKnownGame(id: string, overrides: Partial<IGame> = {}): IGame {
  return {
    id,
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

function makeManager(extensionGames: IGame[]): { manager: GameModeManager; dispatched: any[] } {
  const dispatched: any[] = [];
  const manager = new GameModeManager({} as any, extensionGames, [], () => undefined);
  manager.attachToStore({ dispatch: (action: any) => dispatched.push(action) } as any);
  return { manager, dispatched };
}

function dispatchedKnownGames(dispatched: any[]): IGameStored[] {
  const actions = dispatched.filter((action) => action.type === setKnownGames.getType());
  return actions[actions.length - 1]?.payload ?? [];
}

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
    expect(known.map((iter) => iter.id)).toEqual(["existing", "somegame"]);
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

describe("GameModeManager default primary tool", () => {
  const gameId = "skyrimse";

  function makeTool(overrides: Partial<IDiscoveredTool> = {}): IDiscoveredTool {
    return {
      id: "skse",
      name: "SKSE",
      executable: () => "skse64_loader.exe",
      requiredFiles: [],
      path: "C:/games/skyrimse/skse64_loader.exe",
      hidden: false,
      custom: false,
      defaultPrimary: true,
      ...overrides,
    };
  }

  function setup(opts: { activeGameId?: string; tools?: Record<string, IDiscoveredTool> } = {}) {
    const harness = makeApiHarness(
      {
        profiles: { "profile-1": makeProfile({ gameId: opts.activeGameId ?? gameId }) },
        activeProfileId: "profile-1",
        discovered: { [gameId]: { path: "C:/games/skyrimse" } },
      },
      [
        { path: ["settings", "gameMode"], reducer: gameModeSettingsReducer },
        { path: ["settings", "interface"], reducer: interfaceSettingsReducer },
      ],
    );
    harness.setState((draft) => {
      draft.settings.gameMode.discovered[gameId].tools = opts.tools ?? {};
    });
    const manager = new GameModeManager({} as any, [], [], () => undefined);
    manager.attachToStore(harness.api.store as any);
    const discover = (tool: IDiscoveredTool) => manager["onDiscoveredTool"](gameId, tool);
    const primaryTool = () => harness.getState().settings.interface.primaryTool?.[gameId];
    return { harness, discover, primaryTool };
  }

  it("selects a default tool discovered after the game was activated", () => {
    const { discover, primaryTool } = setup();

    discover(makeTool());

    expect(primaryTool()).toBe("skse");
  });

  it.each([null, "other-tool"])("keeps the user's choice %s", (choice) => {
    const { harness, discover, primaryTool } = setup();
    harness.setState((draft) => {
      draft.settings.interface.primaryTool = { [gameId]: choice };
    });

    discover(makeTool());

    expect(primaryTool()).toBe(choice);
  });

  it("ignores tools discovered for a game that isn't active", () => {
    const { discover, primaryTool } = setup({ activeGameId: "fallout4" });

    discover(makeTool());

    expect(primaryTool()).toBeUndefined();
  });

  it("doesn't select a default tool the user hid", () => {
    const { discover, primaryTool } = setup({ tools: { skse: makeTool({ hidden: true }) } });

    discover(makeTool());

    expect(primaryTool()).toBeUndefined();
  });

  it("ignores tools that aren't a default", () => {
    const { discover, primaryTool } = setup();

    discover(makeTool({ defaultPrimary: false }));

    expect(primaryTool()).toBeUndefined();
  });
});
