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

/**
 * Monitors the active game and discovered tools by polling process snapshots.
 * Uses a 2s cadence when focused and 5s when unfocused, without overlapping checks.
 */
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

  /** Start polling; safe to call multiple times. */
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

    // Parse the executable path from a raw command line; handles quoted paths.
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

    // Prefer explicit process path; fall back to cmd-derived path when available.
    const getProcessPath = (proc: IProcessInfo): string | undefined =>
      proc.path ?? getCommandPath(proc.cmd);

    // Map for quick PID lookup to validate cached tool PIDs (avoid stale PID reuse).
    const byPid: { [pid: number]: IProcessInfo } = processes.reduce(
      (prev, proc) => {
        prev[proc.pid] = proc;
        return prev;
      },
      {},
    );

    // Map by exeId (normalized basename) for name-based candidate lookup.
    const byName: { [exeId: string]: IProcessInfo[] } = processes.reduce(
      (prev: { [exeId: string]: IProcessInfo[] }, proc) => {
        setdefault(prev, makeExeId(proc.name), []).push(proc);
        return prev;
      },
      {} as { [exeId: string]: IProcessInfo[] },
    );

    const state = this.mStore.getState();
    const vortexPid = process.pid;

    // Only treat child processes as tool instances unless detached processes are allowed.
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

    // Match logic: prefer full path match; fall back to name-only when all paths are missing.
    // Limitations: basename collisions and detached processes can lead to false matches.
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

      if (knownRunning !== undefined) {
        // Verify cached PID is still valid to detect stale PID reuse.
        const knownProc = byPid[knownRunning.pid];
        if (knownProc !== undefined) {
          // We know this process is running. If considerDetached is true, we're done.
          // If considerDetached is false, we need to verify it's still a child process.
          if (considerDetached || isChildProcess(knownProc, new Set())) {
            return;
          }
        }
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
      // Note: basename collisions can lead to false matches when multiple executables share the same name.
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

  /** Stop polling and clear any pending timer. */
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
