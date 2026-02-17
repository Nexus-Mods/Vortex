import * as path from "path";
import ProcessMonitor from "../util/ProcessMonitor";
import type { IProcessInfo, IProcessProvider } from "../util/processProvider";
import { setToolPid, setToolStopped } from "../../../renderer/actions";
import { makeExeId } from "../../../reducers/session";
import type { IDiscoveredTool } from "../../../renderer/types/IDiscoveredTool";
import type { IExtensionApi } from "../../../renderer/types/IExtensionContext";
import type { IState } from "../../../renderer/types/IState";

const gameId = "test-game";
const profileId = "profile-1";
const gamePath = "/games/test";
const gameExe = "Game.exe";
const gameExePath = path.join(gamePath, gameExe);
const toolPath = "/games/test/Tool.exe";

const buildTool = (
  overrides: Partial<IDiscoveredTool> = {},
): IDiscoveredTool => ({
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
    dispatch: jest.fn(),
    getState: jest.fn(() => state),
  };
  const processProvider: IProcessProvider = {
    list: jest.fn().mockResolvedValue(processes),
  };
  const monitor = new ProcessMonitor(
    { store } as unknown as IExtensionApi,
    processProvider,
  );
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

  expect(store.dispatch).toHaveBeenCalledWith(
    setToolPid(toolPath, 3001, false),
  );
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

  expect(store.dispatch).toHaveBeenNthCalledWith(
    1,
    setToolPid(gameExePath, 6001, true),
  );
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

  expect(store.dispatch).toHaveBeenCalledWith(
    setToolPid(spacedGameExePath, 8001, true),
  );
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
