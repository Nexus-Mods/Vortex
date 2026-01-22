import { setToolPid, setToolStopped } from "../../../actions";
import { makeExeId } from "../../../reducers/session";
import type { IDiscoveredTool } from "../../../types/IDiscoveredTool";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { log } from "../../../util/log";
import { currentGame, currentGameDiscovery } from "../../../util/selectors";
import { getSafe } from "../../../util/storeHelper";
import { setdefault } from "../../../util/util";

import type { BrowserWindow } from "electron";
import * as path from "path";
import type * as Redux from "redux";
import type { IProcessInfo, IProcessProvider } from "./processProvider";
import { defaultProcessProvider } from "./processProvider";

class ProcessMonitor {
  private mTimer: NodeJS.Timeout;
  private mStore: Redux.Store<IState>;
  private mWindow: BrowserWindow;
  private mActive: boolean = false;
  private mProcessProvider: IProcessProvider;

  constructor(
    api: IExtensionApi,
    processProvider: IProcessProvider = defaultProcessProvider,
  ) {
    this.mStore = api.store;
    this.mProcessProvider = processProvider;
  }

  public start(): void {
    if (this.mActive) {
      return;
    }

    if (this.mTimer !== undefined) {
      clearTimeout(this.mTimer);
    }

    if (process.type === "renderer") {
      this.mWindow = require("@electron/remote").getCurrentWindow();
    }

    log("debug", "start process monitor");
    this.mActive = true;
    this.mTimer = setTimeout(() => this.check(), 2000);
  }

  private check(): void {
    if (!this.mActive) {
      return;
    }

    const isFocused = this.mWindow === undefined || this.mWindow.isFocused();
    const delay = isFocused ? 2000 : 5000;
    const startedAt = Date.now();

    void this.doCheck()
      .catch((err) => log("warn", "process monitor check failed", err))
      .finally(() => {
        if (this.mActive) {
          const elapsed = Date.now() - startedAt;
          const remaining = Math.max(0, delay - elapsed);
          // Avoid overlapping async checks; preserve cadence by subtracting elapsed time.
          this.mTimer = setTimeout(() => this.check(), remaining);
        }
      });
  }

  private async doCheck(): Promise<void> {
    let processes: IProcessInfo[];
    try {
      processes = await this.mProcessProvider.list();
    } catch (err) {
      log("warn", "failed to list processes", err);
      return;
    }

    const getCommandPath = (cmd?: string): string | undefined => {
      if (!cmd) {
        return undefined;
      }
      const trimmed = cmd.trim();
      if (trimmed.startsWith('"')) {
        const end = trimmed.indexOf('"', 1);
        return end > 1 ? trimmed.slice(1, end) : undefined;
      }
      const first = trimmed.split(" ")[0];
      return first.length > 0 ? first : undefined;
    };

    const getProcessPath = (proc: IProcessInfo): string | undefined =>
      proc.path ?? getCommandPath(proc.cmd);

    const byPid: { [pid: number]: IProcessInfo } = processes.reduce(
      (prev, proc) => {
        prev[proc.pid] = proc;
        return prev;
      },
      {},
    );

    const byName: { [exeId: string]: IProcessInfo[] } = processes.reduce(
      (prev: { [exeId: string]: IProcessInfo[] }, proc) => {
        setdefault(prev, makeExeId(proc.name), []).push(proc);
        return prev;
      },
      {} as { [exeId: string]: IProcessInfo[] },
    );

    const state = this.mStore.getState();
    const vortexPid = process.pid;

    const isChildProcess = (
      proc: IProcessInfo,
      visited: Set<number>,
    ): boolean => {
      if (proc === undefined || proc.ppid === 0) {
        return false;
      } else if (visited.has(proc.ppid)) {
        return false;
      }
      visited.add(proc.ppid);
      return (
        proc.ppid === vortexPid || isChildProcess(byPid[proc.ppid], visited)
      );
    };

    const update = (
      exePath: string,
      exclusive: boolean,
      considerDetached: boolean,
    ) => {
      const exeId = makeExeId(exePath);
      const knownRunning = state.session.base.toolsRunning[exeId];
      const exeRunning = byName[exeId];

      if (exeRunning === undefined) {
        if (knownRunning !== undefined) {
          this.mStore.dispatch(setToolStopped(exePath));
        }
        return;
      }

      if (knownRunning !== undefined && byPid[knownRunning.pid] !== undefined) {
        // We already know this tool is running and the process is still active.
        return;
      }

      const candidates = considerDetached
        ? exeRunning
        : exeRunning.filter((proc) => isChildProcess(proc, new Set()));
      const exePathLower = exePath.toLowerCase();
      const candidatesWithPath = candidates.map((proc) => ({
        proc,
        path: getProcessPath(proc),
      }));
      const pathMatch = candidatesWithPath.find(
        (entry) =>
          entry.path !== undefined && entry.path.toLowerCase() === exePathLower,
      );

      if (pathMatch !== undefined) {
        this.mStore.dispatch(
          setToolPid(exePath, pathMatch.proc.pid, exclusive),
        );
        return;
      }

      // Fallback: when ps-list does not expose path/cmd (Windows), accept name-only.
      if (
        candidatesWithPath.length > 0 &&
        candidatesWithPath.every((entry) => entry.path === undefined)
      ) {
        this.mStore.dispatch(
          setToolPid(exePath, candidatesWithPath[0].proc.pid, exclusive),
        );
        return;
      }

      if (knownRunning !== undefined) {
        this.mStore.dispatch(setToolStopped(exePath));
      }
    };

    const game = currentGame(state);
    const gameDiscovery = currentGameDiscovery(state);
    const gameExe =
      getSafe(gameDiscovery, ["executable"], undefined) ||
      getSafe(game, ["executable"], undefined);
    const gamePath = getSafe(gameDiscovery, ["path"], undefined);
    if (gameExe === undefined || gamePath === undefined) {
      return;
    }

    const gameExePath = path.join(gamePath, gameExe);
    update(gameExePath, true, true);

    const discoveredTools: { [toolId: string]: IDiscoveredTool } = getSafe(
      state,
      ["settings", "gameMode", "discovered", game.id, "tools"],
      {},
    );

    Object.keys(discoveredTools).forEach((toolId) => {
      if (discoveredTools[toolId].path === undefined) {
        return;
      }
      update(
        discoveredTools[toolId].path,
        discoveredTools[toolId].exclusive || false,
        false,
      );
    });
  }

  public end(): void {
    if (this.mTimer === undefined) {
      return;
    }
    clearTimeout(this.mTimer);
    this.mTimer = undefined;
    this.mActive = false;
    log("debug", "stop process monitor");
  }
}

export default ProcessMonitor;
