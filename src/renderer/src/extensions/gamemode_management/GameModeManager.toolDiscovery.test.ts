import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../util/log", () => ({ log: vi.fn() }));

// GameModeManager pulls in util/Steam, which constructs its singleton at import time. Off Windows
// that constructor resolves a Steam install from the home directory via getVortexPath, and there is
// no initialised ApplicationData to read paths from here -- so the import throws on the Linux CI
// runner while passing locally on Windows, which takes the registry branch instead.
vi.mock("../../util/getVortexPath", () => ({
  default: vi.fn(() => "/tmp"),
  getVortexQualifiedPath: vi.fn(),
}));

// The discovery pass is the input here. Script extenders are `relative` tools: discoverRelativeTools
// walks the game folder and, for each required file it sees, verifies the tool's directory and
// then reports it through onDiscoveredTool. That report is not awaited (onFile fires
// testApplicationDirValid and moves on), so it can arrive after the returned promise settles. The
// fake keeps that rule: it resolves first and plays back the finds a test scripts into
// `discoveredTools` on a later tick, and tests wait for that tick (`discover`).
vi.mock("./util/discovery", () => ({
  quickDiscoveryTools: vi.fn(() => Promise.resolve()),
  discoverRelativeTools: vi.fn(
    (
      game: { id: string },
      _gamePath: string,
      _discoveredGames: unknown,
      onDiscoveredTool: (id: string, tool: unknown) => void,
    ) => {
      const finds = discoveredTools.map((tool) => ({ ...tool }));
      setTimeout(() => finds.forEach((tool) => onDiscoveredTool(game.id, tool)), 0);
      return Promise.resolve();
    },
  ),
  quickDiscovery: vi.fn(() => Promise.resolve([])),
  searchDiscovery: vi.fn(() => Promise.resolve(0)),
  assertToolDir: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock("../../util/api", () => ({ getNormalizeFunc: () => Promise.resolve((x: string) => x) }));

// activating a game checks that its mod directory exists and is writable before discovering tools
vi.mock("../../util/fs", async () => {
  const { default: PromiseBB } = await import("bluebird");
  return {
    statAsync: vi.fn(() => PromiseBB.resolve({})),
    ensureDirWritableAsync: vi.fn(() => PromiseBB.resolve()),
  };
});

import {
  makeApiHarness,
  makeDiscoveredTool,
  makeGame,
  makeProfile,
} from "../../test-utils/builders";
import type { IDiscoveredTool } from "../../types/IDiscoveredTool";
import type { IState } from "../../types/IState";
import { setPrimaryTool } from "../starter_dashlet/actions";
import starterReducer from "../starter_dashlet/reducers";
import GameModeManager from "./GameModeManager";
import { settingsReducer } from "./reducers/settings/settings";

const discoveredTools: IDiscoveredTool[] = [];

const GAME = "skyrimse";
const OTHER_GAME = "fallout4";
const SCRIPT_EXTENDER = "skse64";
// a tool the game extension declares as its default launcher
const SCRIPT_EXTENDER_TOOL: Partial<IDiscoveredTool> = {
  id: SCRIPT_EXTENDER,
  defaultPrimary: true,
};

interface ISetupOpts {
  // the profile that is active when discovery reports the tool
  activeGameId?: string;
  // a primary tool the user (or an earlier discovery) already settled on
  primaryTool?: string | null;
  // the tool record already in settings.gameMode.discovered, if any
  existingTool?: { custom?: boolean; hidden?: boolean; defaultPrimary?: boolean };
  // further tool records already in settings.gameMode.discovered, in key order
  otherTools?: Record<string, Partial<IDiscoveredTool>>;
}

function setup(opts: ISetupOpts = {}) {
  const activeGameId = opts.activeGameId ?? GAME;
  const harness = makeApiHarness(
    { profiles: { "profile-1": makeProfile({ id: "profile-1", gameId: activeGameId }) } },
    [
      { path: ["settings", "gameMode"], reducer: settingsReducer },
      { path: ["settings", "interface"], reducer: starterReducer },
    ],
  );
  harness.setState((draft: IState) => {
    draft.settings.profiles.activeProfileId = "profile-1";
    draft.settings.gameMode.discovered[GAME] = {
      path: `C:/games/${GAME}`,
      tools: {
        ...opts.otherTools,
        ...(opts.existingTool !== undefined
          ? { [SCRIPT_EXTENDER]: { id: SCRIPT_EXTENDER, ...opts.existingTool } }
          : {}),
      },
    } as never;
    if (opts.primaryTool !== undefined) {
      draft.settings.interface.primaryTool = { [GAME]: opts.primaryTool };
    }
  });

  const manager = new GameModeManager(
    harness.api,
    [makeGame({ id: GAME }), makeGame({ id: OTHER_GAME })],
    [],
    () => undefined,
  );
  manager.attachToStore(harness.api.store as never);
  return { harness, manager };
}

function primaryToolDispatches(harness: ReturnType<typeof setup>["harness"]) {
  return harness.dispatched.filter((action) => action.type === setPrimaryTool.getType());
}

// run deploy-time tool discovery, then wait for the reports the fake delivers on a later tick
async function discover(manager: GameModeManager) {
  await manager.startToolDiscovery(GAME);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  discoveredTools.length = 0;
});

async function activate(manager: GameModeManager) {
  await manager.setGameMode(undefined, GAME, "profile-1");
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("GameModeManager tool discovery", () => {
  // Regression for #19543: discovery also runs after a deployment, on an already-active game --
  // the path a collection installing a script extender takes. The default used to be selected only
  // while activating the game, so the extender showed up under Tools but Quick Launch kept
  // starting the vanilla executable (reverting any .ini tweaks the collection shipped).
  it("selects a declared default primary tool discovered after the game became active", async () => {
    discoveredTools.push(makeDiscoveredTool(SCRIPT_EXTENDER_TOOL));
    const { harness, manager } = setup();

    await discover(manager);

    expect(primaryToolDispatches(harness)).toEqual([setPrimaryTool(GAME, SCRIPT_EXTENDER)]);
    expect(harness.api.getState().settings.interface.primaryTool?.[GAME]).toBe(SCRIPT_EXTENDER);
  });

  // The reported sequence: the loader was missing when the game was activated, so the
  // primary-tool check dispatched setPrimaryTool(game, undefined) and kept the stale tool record.
  // A collection then deployed the extender. Only a restart used to restore it as the launcher.
  it("selects the default again after the primary-tool check cleared a missing launcher", async () => {
    discoveredTools.push(makeDiscoveredTool(SCRIPT_EXTENDER_TOOL));
    const { harness, manager } = setup({ existingTool: { defaultPrimary: true } });
    harness.setState((draft: IState) => {
      draft.settings.interface.primaryTool = { [GAME]: undefined };
    });

    await discover(manager);

    expect(primaryToolDispatches(harness)).toEqual([setPrimaryTool(GAME, SCRIPT_EXTENDER)]);
    expect(harness.api.getState().settings.interface.primaryTool?.[GAME]).toBe(SCRIPT_EXTENDER);
  });

  it("keeps a primary tool the user already chose", async () => {
    discoveredTools.push(makeDiscoveredTool(SCRIPT_EXTENDER_TOOL));
    const { harness, manager } = setup({ primaryTool: "loot" });

    await discover(manager);

    expect(primaryToolDispatches(harness)).toEqual([]);
  });

  // The Tools page stores null when the user removes the default launcher; that choice stands.
  it("keeps a launcher the user cleared", async () => {
    discoveredTools.push(makeDiscoveredTool(SCRIPT_EXTENDER_TOOL));
    const { harness, manager } = setup({ primaryTool: null });

    await discover(manager);

    expect(primaryToolDispatches(harness)).toEqual([]);
  });

  it("keeps a choice cleared before the late discovery report", async () => {
    discoveredTools.push(makeDiscoveredTool(SCRIPT_EXTENDER_TOOL));
    const { harness, manager } = setup();
    await manager.startToolDiscovery(GAME);
    harness.api.store.dispatch(setPrimaryTool(GAME, null));
    const before = primaryToolDispatches(harness).length;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(primaryToolDispatches(harness)).toHaveLength(before);
    expect(harness.api.getState().settings.interface.primaryTool?.[GAME]).toBeNull();
    expect(
      harness.api.getState().settings.gameMode.discovered[GAME].tools[SCRIPT_EXTENDER],
    ).toBeDefined();
  });

  it("does not select a launcher when the profile changes before the late report", async () => {
    discoveredTools.push(makeDiscoveredTool(SCRIPT_EXTENDER_TOOL));
    const { harness, manager } = setup();
    await manager.startToolDiscovery(GAME);
    harness.setState((draft) => {
      draft.persistent.profiles["profile-1"].gameId = OTHER_GAME;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(primaryToolDispatches(harness)).toEqual([]);
    expect(
      harness.api.getState().settings.gameMode.discovered[GAME].tools[SCRIPT_EXTENDER],
    ).toBeDefined();
  });

  it("does not select the same default twice when discovery reports it twice", async () => {
    discoveredTools.push(
      makeDiscoveredTool(SCRIPT_EXTENDER_TOOL),
      makeDiscoveredTool(SCRIPT_EXTENDER_TOOL),
    );
    const { harness, manager } = setup();
    await discover(manager);
    expect(primaryToolDispatches(harness)).toEqual([setPrimaryTool(GAME, SCRIPT_EXTENDER)]);
    expect(harness.api.getState().settings.interface.primaryTool?.[GAME]).toBe(SCRIPT_EXTENDER);
  });

  it("ignores a discovered tool that isn't a declared default", async () => {
    discoveredTools.push(makeDiscoveredTool({ id: "loot" }));
    const { harness, manager } = setup();

    await discover(manager);

    expect(primaryToolDispatches(harness)).toEqual([]);
  });

  // Quick discovery runs every known game's queryPath tools, whether or not the game itself was
  // found, so a tool can be reported for a game with no discovery entry. addDiscoveredTool ignores
  // it; selecting a default must not throw on the missing entry either. That pass calls
  // onDiscoveredTool from quickDiscovery, which needs store scanning to drive, so it is called here
  // directly with what that pass reports.
  it("ignores a default reported for a game with no discovery entry", () => {
    const { harness, manager } = setup();
    harness.setState((draft: IState) => {
      delete draft.settings.gameMode.discovered[GAME];
    });
    const onDiscoveredTool = (
      manager as unknown as { onDiscoveredTool: (gameId: string, tool: IDiscoveredTool) => void }
    ).onDiscoveredTool;

    expect(() =>
      onDiscoveredTool(GAME, makeDiscoveredTool({ ...SCRIPT_EXTENDER_TOOL, path: "skse.exe" })),
    ).not.toThrow();
    expect(primaryToolDispatches(harness)).toEqual([]);
  });

  it("doesn't select a default for a game that isn't the active one", async () => {
    discoveredTools.push(makeDiscoveredTool(SCRIPT_EXTENDER_TOOL));
    const { harness, manager } = setup({ activeGameId: OTHER_GAME });

    await discover(manager);

    expect(primaryToolDispatches(harness)).toEqual([]);
  });

  it("doesn't overwrite a tool the user customised", async () => {
    discoveredTools.push(makeDiscoveredTool(SCRIPT_EXTENDER_TOOL));
    const { harness, manager } = setup({ existingTool: { custom: true } });

    await discover(manager);

    expect(
      harness.dispatched.filter((action) => action.type.includes("ADD_DISCOVERED_TOOL")),
    ).toEqual([]);
  });

  // `custom` protects the tool *record* from being overwritten by discovery; it is not a statement
  // about which tool should launch. A customised entry is still eligible to become the default
  // launcher, matching setGameMode, which picks any discovered.tools entry with defaultPrimary and
  // likewise does not consult `custom`. Pinned because the two paths implement one feature and
  // must agree: making only this one skip customised tools would leave a game whose extender the
  // user has customised with no default launcher, while activating the same game would set one.
  it("still selects a customised tool as the default launcher", async () => {
    discoveredTools.push(makeDiscoveredTool(SCRIPT_EXTENDER_TOOL));
    const { harness, manager } = setup({ existingTool: { custom: true } });

    await discover(manager);

    expect(primaryToolDispatches(harness)).toEqual([setPrimaryTool(GAME, SCRIPT_EXTENDER)]);
    expect(harness.api.getState().settings.interface.primaryTool?.[GAME]).toBe(SCRIPT_EXTENDER);
  });
  // A tool the user removed from the Tools page is stored with `hidden: true`. The Tools page then
  // shows no default launcher, but Quick Launch starts whatever primaryTool names, so promoting a
  // hidden tool would silently launch something the user deleted.
  it("doesn't select a default primary tool the user removed", async () => {
    discoveredTools.push(makeDiscoveredTool(SCRIPT_EXTENDER_TOOL));
    const { harness, manager } = setup({ existingTool: { hidden: true } });

    await discover(manager);

    expect(primaryToolDispatches(harness)).toEqual([]);
  });

  // Discovery and activation must agree on which default wins when a game declares more than one.
  it("selects the same default as game activation when several are declared", async () => {
    discoveredTools.push(makeDiscoveredTool(SCRIPT_EXTENDER_TOOL));
    const { harness, manager } = setup({
      otherTools: { loader: makeDiscoveredTool({ id: "loader", defaultPrimary: true }) },
    });

    await discover(manager);

    expect(primaryToolDispatches(harness)).toEqual([setPrimaryTool(GAME, "loader")]);
  });
});

describe("GameModeManager game activation", () => {
  it("keeps an explicitly cleared launcher during activation", async () => {
    const { harness, manager } = setup({
      primaryTool: null,
      existingTool: { defaultPrimary: true },
    });
    await activate(manager);
    expect(primaryToolDispatches(harness)).toEqual([]);
    expect(harness.api.getState().settings.interface.primaryTool?.[GAME]).toBeNull();
  });

  it("keeps a named launcher during activation", async () => {
    const { harness, manager } = setup({
      primaryTool: "loot",
      existingTool: { defaultPrimary: true },
    });
    await activate(manager);
    expect(primaryToolDispatches(harness)).toEqual([]);
    expect(harness.api.getState().settings.interface.primaryTool?.[GAME]).toBe("loot");
  });

  it("does not change the launcher after the active profile changes", async () => {
    const { harness, manager } = setup({ existingTool: { defaultPrimary: true } });
    harness.setState((draft) => {
      draft.settings.profiles.activeProfileId = undefined;
    });
    await activate(manager);
    expect(primaryToolDispatches(harness)).toEqual([]);
  });

  it("selects a declared default primary tool", async () => {
    const { harness, manager } = setup({ existingTool: { defaultPrimary: true } });

    await activate(manager);

    expect(primaryToolDispatches(harness)).toEqual([setPrimaryTool(GAME, SCRIPT_EXTENDER)]);
    expect(harness.api.getState().settings.interface.primaryTool?.[GAME]).toBe(SCRIPT_EXTENDER);
  });

  it("doesn't select a default primary tool the user removed", async () => {
    const { harness, manager } = setup({
      existingTool: { defaultPrimary: true, hidden: true },
    });

    await activate(manager);

    expect(primaryToolDispatches(harness)).toEqual([]);
  });
});
