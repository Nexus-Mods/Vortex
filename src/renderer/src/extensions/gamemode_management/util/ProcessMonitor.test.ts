import * as path from "path";

import { it, expect, vi } from "vitest";

import { setToolPid, setToolStopped } from "../../../actions";
import { makeExeId } from "../../../reducers/session";
import type { IDiscoveredTool } from "../../../types/IDiscoveredTool";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import ProcessMonitor from "./ProcessMonitor";
import type { IProcessInfo, IProcessProvider } from "./processProvider";

const gameId = "test-game";
const profileId = "profile-1";
const gamePath = "/games/test";
const gameExe = "Game.exe";
const gameExePath = path.join(gamePath, gameExe);
const toolPath = "/games/test/Tool.exe";

const buildTool = (overrides: Partial<IDiscoveredTool> = {}): IDiscoveredTool => ({
  id: "tool-1",
  name: "Tool",
  executable: () => "Tool.exe",
  requiredFiles: [],
  path: toolPath,
  hidden: false,
  custom: true,
  exclusive: false,
  ...overrides,
});

const buildState = (
  overrides: {
    toolsRunning?: IState["session"]["base"]["toolsRunning"];
    tools?: { [id: string]: IDiscoveredTool };
    gamePath?: string;
    gameExe?: string;
  } = {},
): IState => {
  const resolvedGamePath = overrides.gamePath ?? gamePath;
  const resolvedGameExe = overrides.gameExe ?? gameExe;

  return {
    session: {
      base: {
        toolsRunning: overrides.toolsRunning ?? {},
      },
      gameMode: {
        known: [
          {
            id: gameId,
            name: "Test Game",
            executable: resolvedGameExe,
            requiredFiles: [],
          },
        ],
      },
    },
    settings: {
      profiles: {
        activeProfileId: profileId,
      },
      gameMode: {
        discovered: {
          [gameId]: {
            path: resolvedGamePath,
            executable: resolvedGameExe,
            tools: overrides.tools ?? {},
          },
        },
      },
    },
    persistent: {
      profiles: {
        [profileId]: { id: profileId, gameId },
      },
    },
  } as unknown as IState;
};

const createMonitor = (state: IState, processes: IProcessInfo[]) => {
  const store = {
    dispatch: vi.fn(),
    getState: vi.fn(() => state),
  };
  const processProvider: IProcessProvider = {
    list: vi.fn().mockResolvedValue(processes),
  };
  const monitor = new ProcessMonitor({ store } as unknown as IExtensionApi, processProvider);
  return {
    monitor: monitor as unknown as { doCheck(): Promise<void> },
    store,
    processProvider,
  };
};

it("dispatches setToolPid for matching child process", async () => {
  const tool = buildTool();
  const state = buildState({ tools: { [tool.id]: tool } });
  const processes: IProcessInfo[] = [
    {
      pid: 3001,
      ppid: process.pid,
      name: "Tool.exe",
      path: toolPath,
    },
  ];
  const { monitor, store } = createMonitor(state, processes);

  await monitor.doCheck();

  expect(store.dispatch).toHaveBeenCalledWith(setToolPid(toolPath, 3001, false));
});

it("dispatches setToolStopped when no matching process exists", async () => {
  const tool = buildTool();
  const state = buildState({
    tools: { [tool.id]: tool },
    toolsRunning: {
      [makeExeId(toolPath)]: { pid: 4001, started: 1, exclusive: false },
    },
  });
  const { monitor, store } = createMonitor(state, []);

  await monitor.doCheck();

  expect(store.dispatch).toHaveBeenCalledWith(setToolStopped(toolPath));
});

it("matches detached game but filters non-child tools", async () => {
  const tool = buildTool();
  const state = buildState({
    tools: { [tool.id]: tool },
    toolsRunning: {
      [makeExeId(toolPath)]: { pid: 5001, started: 1, exclusive: false },
    },
  });
  const processes: IProcessInfo[] = [
    {
      pid: 5001,
      ppid: 0,
      name: "Tool.exe",
      path: toolPath,
    },
    {
      pid: 6001,
      ppid: 0,
      name: "Game.exe",
      path: gameExePath,
    },
  ];
  const { monitor, store } = createMonitor(state, processes);

  await monitor.doCheck();

  expect(store.dispatch).toHaveBeenNthCalledWith(1, setToolPid(gameExePath, 6001, true));
  expect(store.dispatch).toHaveBeenNthCalledWith(2, setToolStopped(toolPath));
});

it("parses unquoted cmd paths with spaces", async () => {
  const spacedGamePath = "/games/test path";
  const spacedGameExe = "StardewValley";
  const spacedGameExePath = path.join(spacedGamePath, spacedGameExe);
  const state = buildState({
    gamePath: spacedGamePath,
    gameExe: spacedGameExe,
  });
  const processes: IProcessInfo[] = [
    {
      pid: 8001,
      ppid: 0,
      name: spacedGameExe,
      cmd: `${spacedGameExePath} --arg`,
    },
  ];
  const { monitor, store } = createMonitor(state, processes);

  await monitor.doCheck();

  expect(store.dispatch).toHaveBeenCalledWith(setToolPid(spacedGameExePath, 8001, true));
});

it("skips dispatch when known pid still exists", async () => {
  const state = buildState({
    tools: {},
    toolsRunning: {
      [makeExeId(gameExePath)]: {
        pid: 7001,
        started: 1,
        exclusive: true,
      },
    },
  });
  const processes: IProcessInfo[] = [
    {
      pid: 7001,
      ppid: 0,
      name: "Game.exe",
      path: gameExePath,
    },
  ];
  const { monitor, store } = createMonitor(state, processes);

  await monitor.doCheck();

  expect(store.dispatch).not.toHaveBeenCalled();
});

it.skipIf(process.platform === "win32")("matches a tool running under Wine", async () => {
  const longToolPath = "/games/test/BodySlide x64.exe";
  const tool = buildTool({ path: longToolPath });
  const state = buildState({ tools: { [tool.id]: tool } });
  // Wine truncates the name to 15 characters and the process isn't a child of Vortex
  const processes: IProcessInfo[] = [
    { pid: 5001, ppid: 1, name: "BodySlide x64.e", cmd: "Z:\\games\\test\\BodySlide x64.exe -x" },
  ];
  const { monitor, store } = createMonitor(state, processes);

  await monitor.doCheck();

  expect(store.dispatch).toHaveBeenCalledWith(setToolPid(longToolPath, 5001, false));
});

it.skipIf(process.platform === "win32")("waits for a tool that is still starting", async () => {
  const tool = buildTool();
  const state = buildState({
    tools: { [tool.id]: tool },
    toolsRunning: {
      [makeExeId(toolPath)]: { pid: undefined, started: Date.now(), exclusive: false },
    },
  });
  const { monitor, store } = createMonitor(state, []);

  await monitor.doCheck();

  expect(store.dispatch).not.toHaveBeenCalledWith(setToolStopped(toolPath));
});
