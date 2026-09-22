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

// the discovery pass itself is the thing under test's *input*: quickDiscoveryTools is what reports
// a tool it found back through onDiscoveredTool, so the mock plays back the finds a test scripts
// into `discoveredTools` (populated per test, read when the mock is called).
vi.mock("./util/discovery", () => ({
  quickDiscoveryTools: vi.fn(
    (gameId: string, _tools: unknown, onDiscoveredTool: (id: string, tool: unknown) => void) => {
      discoveredTools.forEach((tool) => onDiscoveredTool(gameId, { ...tool }));
      return Promise.resolve();
    },
  ),
  discoverRelativeTools: vi.fn(() => Promise.resolve()),
  quickDiscovery: vi.fn(() => Promise.resolve([])),
  searchDiscovery: vi.fn(() => Promise.resolve(0)),
  assertToolDir: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock("../../util/api", () => ({ getNormalizeFunc: () => Promise.resolve((x: string) => x) }));

import { makeApiHarness, makeProfile } from "../../test-utils/builders";
import type { IDiscoveredTool } from "../../types/IDiscoveredTool";
import type { IGame } from "../../types/IGame";
import type { IState } from "../../types/IState";
import { setPrimaryTool } from "../starter_dashlet/actions";
import GameModeManager from "./GameModeManager";

const discoveredTools: IDiscoveredTool[] = [];

const GAME = "skyrimse";
const OTHER_GAME = "fallout4";
const SCRIPT_EXTENDER = "skse64";

function makeGame(id = GAME): IGame {
  return {
    id,
    name: id,
    executable: () => `${id}.exe`,
    requiredFiles: [],
    queryModPath: () => "mods",
    supportedTools: [],
  } as unknown as IGame;
}

function makeDiscoveredTool(overrides: Partial<IDiscoveredTool> = {}): IDiscoveredTool {
  return {
    id: SCRIPT_EXTENDER,
    name: "Skyrim Script Extender",
    path: `C:/games/${GAME}/${SCRIPT_EXTENDER}_loader.exe`,
    executable: () => `${SCRIPT_EXTENDER}_loader.exe`,
    requiredFiles: [],
    defaultPrimary: true,
    hidden: false,
    custom: false,
    ...overrides,
  } as unknown as IDiscoveredTool;
}

interface ISetupOpts {
  // the profile that is active when discovery reports the tool
  activeGameId?: string;
  // a primary tool the user (or an earlier discovery) already settled on
  primaryTool?: string;
  // the tool record already in settings.gameMode.discovered, if any
  existingTool?: { custom?: boolean };
}

function setup(opts: ISetupOpts = {}) {
  const activeGameId = opts.activeGameId ?? GAME;
  const harness = makeApiHarness({
    profiles: { "profile-1": makeProfile({ id: "profile-1", gameId: activeGameId }) },
  });
  harness.setState((draft: IState) => {
    draft.settings.profiles.activeProfileId = "profile-1";
    draft.settings.gameMode.discovered[GAME] = {
      path: `C:/games/${GAME}`,
      tools:
        opts.existingTool !== undefined
          ? { [SCRIPT_EXTENDER]: { id: SCRIPT_EXTENDER, ...opts.existingTool } }
          : {},
    } as never;
    if (opts.primaryTool !== undefined) {
      draft.settings.interface.primaryTool = { [GAME]: opts.primaryTool };
    }
  });

  const manager = new GameModeManager(
    harness.api,
    [makeGame(), makeGame(OTHER_GAME)],
    [],
    () => undefined,
  );
  manager.attachToStore(harness.api.store as never);
  return { harness, manager };
}

function primaryToolDispatches(harness: ReturnType<typeof setup>["harness"]) {
  return harness.dispatched.filter((action) => action.type === setPrimaryTool.getType());
}

describe("GameModeManager tool discovery", () => {
  beforeEach(() => {
    discoveredTools.length = 0;
  });

  // Regression for #19543: discovery also runs after a deployment, on an already-active game --
  // the path a collection installing a script extender takes. The default used to be selected only
  // while activating the game, so the extender showed up under Tools but Quick Launch kept
  // starting the vanilla executable (reverting any .ini tweaks the collection shipped).
  it("selects a declared default primary tool discovered after the game became active", async () => {
    discoveredTools.push(makeDiscoveredTool());
    const { harness, manager } = setup();

    await manager.startToolDiscovery(GAME);

    expect(primaryToolDispatches(harness)).toEqual([setPrimaryTool(GAME, SCRIPT_EXTENDER)]);
  });

  it("keeps a primary tool the user already chose", async () => {
    discoveredTools.push(makeDiscoveredTool());
    const { harness, manager } = setup({ primaryTool: "loot" });

    await manager.startToolDiscovery(GAME);

    expect(primaryToolDispatches(harness)).toEqual([]);
  });

  it("ignores a discovered tool that isn't a declared default", async () => {
    discoveredTools.push(makeDiscoveredTool({ id: "loot", defaultPrimary: undefined }));
    const { harness, manager } = setup();

    await manager.startToolDiscovery(GAME);

    expect(primaryToolDispatches(harness)).toEqual([]);
  });

  it("doesn't select a default for a game that isn't the active one", async () => {
    discoveredTools.push(makeDiscoveredTool());
    const { harness, manager } = setup({ activeGameId: OTHER_GAME });

    await manager.startToolDiscovery(GAME);

    expect(primaryToolDispatches(harness)).toEqual([]);
  });

  it("doesn't overwrite a tool the user customised", async () => {
    discoveredTools.push(makeDiscoveredTool());
    const { harness, manager } = setup({ existingTool: { custom: true } });

    await manager.startToolDiscovery(GAME);

    expect(
      harness.dispatched.filter((action) => action.type.includes("ADD_DISCOVERED_TOOL")),
    ).toEqual([]);
  });
});
