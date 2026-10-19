/**
 * Tests for tools flagged startWithGame: launching the game (or its primary tool) starts them
 * once the game has spawned, without asking to deploy again, and never for a plain tool launch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IToolStored } from "../extensions/gamemode_management/types/IToolStored";
import {
  makeApiHarness,
  makeGameStored,
  makeStarterInfo,
  registerHarnessGame,
  resetHarnessRegistries,
} from "../test-utils/builders";
import type { IApiHarness } from "../test-utils/harnessTypes";
import type { IDiscoveredTool } from "../types/IDiscoveredTool";
import type { IRunOptions } from "../types/IExtensionContext";
import StarterInfo from "./StarterInfo";

const quit = vi.fn();
vi.mock("./application", () => ({ getApplication: () => ({ quit }) }));
// fire-and-forget telemetry ingest, not part of what's under test
vi.mock("../extensions/analytics/utils/modListSnapshot", () => ({
  emitModListSnapshot: vi.fn(() => Promise.resolve()),
}));

const GAME_ID = "skyrimse";
const GAME_EXE = "C:/games/skyrimse/SkyrimSE.exe";
const COMPANION_EXE = "C:/tools/remapper.exe";
const OTHER_EXE = "C:/tools/other.exe";
const LOADER_EXE = "C:/games/skyrimse/skse64_loader.exe";

function knownTool(overrides: Partial<IToolStored>): IToolStored {
  return {
    id: "tool",
    name: "Tool",
    logo: "tool.png",
    executable: "tool.exe",
    parameters: [],
    environment: {},
    ...overrides,
  };
}

function discoveredTool(id: string, exePath: string, overrides: Partial<IDiscoveredTool> = {}) {
  return {
    id,
    name: id,
    path: exePath,
    hidden: false,
    custom: true,
    requiredFiles: [],
    ...overrides,
  } as unknown as IDiscoveredTool;
}

function harness(
  supportedTools: IToolStored[],
  tools: Record<string, IDiscoveredTool>,
): IApiHarness {
  const h = makeApiHarness({
    knownGames: [makeGameStored({ id: GAME_ID, supportedTools })],
    discovered: { [GAME_ID]: { path: "C:/games/skyrimse", tools } as { path: string } },
  });
  // every launch spawns successfully
  h.setRunProcess((options: IRunOptions) => {
    options.onSpawned?.(1234);
    return Promise.resolve();
  });
  return h;
}

const launched = (h: IApiHarness) => h.runExecutableCalls.map((call) => call.executable);

describe("start with game", () => {
  beforeEach(() => {
    registerHarnessGame(GAME_ID);
    quit.mockClear();
  });
  afterEach(() => resetHarnessRegistries());

  it("starts flagged tools after the game, without a second deploy prompt", async () => {
    const h = harness([knownTool({ id: "remapper", startWithGame: true })], {
      remapper: discoveredTool("remapper", COMPANION_EXE, { custom: false }),
      other: discoveredTool("other", OTHER_EXE),
    });

    await StarterInfo.run(makeStarterInfo({ exePath: GAME_EXE }), h.api, vi.fn());

    await vi.waitFor(() => expect(launched(h)).toEqual([GAME_EXE, COMPANION_EXE]));
    expect(h.runExecutableCalls[0].options.suggestDeploy).toBe(true);
    expect(h.runExecutableCalls[1].options.suggestDeploy).toBe(false);
  });

  it("lets the user's setting override the extension default", async () => {
    const h = harness([knownTool({ id: "remapper", startWithGame: true })], {
      remapper: discoveredTool("remapper", COMPANION_EXE, { startWithGame: false }),
    });

    await StarterInfo.run(makeStarterInfo({ exePath: GAME_EXE }), h.api, vi.fn());

    expect(launched(h)).toEqual([GAME_EXE]);
  });

  it("skips a flagged tool that is already running", async () => {
    const h = harness([], {
      remapper: discoveredTool("remapper", COMPANION_EXE, { startWithGame: true }),
    });
    h.setState((draft) => {
      (draft.session as { base?: unknown }).base = {
        toolsRunning: { "remapper.exe": { started: 0, exclusive: false } },
      };
    });

    await StarterInfo.run(makeStarterInfo({ exePath: GAME_EXE }), h.api, vi.fn());

    expect(launched(h)).toEqual([GAME_EXE]);
  });

  it("does not start flagged tools when a plain tool is launched", async () => {
    const h = harness([], {
      remapper: discoveredTool("remapper", COMPANION_EXE, { startWithGame: true }),
      other: discoveredTool("other", OTHER_EXE),
    });
    const tool = makeStarterInfo({ id: "other", isGame: false, exePath: OTHER_EXE });

    await StarterInfo.run(tool, h.api, vi.fn());

    expect(launched(h)).toEqual([OTHER_EXE]);
  });

  it("starts flagged tools when the primary tool launches the game", async () => {
    const h = harness([], {
      skse: discoveredTool("skse", LOADER_EXE, { startWithGame: true }),
      remapper: discoveredTool("remapper", COMPANION_EXE, { startWithGame: true }),
    });
    h.setState((draft) => {
      (draft.settings.interface as { primaryTool?: Record<string, string> }).primaryTool = {
        [GAME_ID]: "skse",
      };
    });
    const loader = makeStarterInfo({ id: "skse", isGame: false, exePath: LOADER_EXE });

    await StarterInfo.run(loader, h.api, vi.fn());

    // the flagged primary tool is the launch itself, it isn't started a second time
    await vi.waitFor(() => expect(launched(h)).toEqual([LOADER_EXE, COMPANION_EXE]));
  });

  it("closes Vortex only after flagged tools have spawned, and detaches them", async () => {
    const h = harness([], {
      remapper: discoveredTool("remapper", COMPANION_EXE, {
        startWithGame: true,
        detach: false,
      }),
    });

    await StarterInfo.run(makeStarterInfo({ exePath: GAME_EXE, onStart: "close" }), h.api, vi.fn());

    await vi.waitFor(() => expect(quit).toHaveBeenCalledTimes(1));
    expect(launched(h)).toEqual([GAME_EXE, COMPANION_EXE]);
    expect(h.runExecutableCalls[1].options.detach).toBe(true);
  });

  it("reports a flagged tool that fails to start without failing the game launch", async () => {
    const h = harness([], {
      remapper: discoveredTool("remapper", COMPANION_EXE, { startWithGame: true }),
    });
    h.setRunProcess((options: IRunOptions) => {
      if (options.suggestDeploy === false) {
        return Promise.reject(Object.assign(new Error("not found"), { code: "ENOENT" }));
      }
      options.onSpawned?.(1234);
      return Promise.resolve();
    });
    const onShowError = vi.fn();

    await StarterInfo.run(makeStarterInfo({ exePath: GAME_EXE }), h.api, onShowError);

    await vi.waitFor(() => expect(onShowError).toHaveBeenCalledTimes(1));
    expect(onShowError.mock.calls[0][0]).toBe("Failed to run tool");
    expect(launched(h)).toEqual([GAME_EXE, COMPANION_EXE]);
  });
});
