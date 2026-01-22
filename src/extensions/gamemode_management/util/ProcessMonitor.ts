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
 * Monitors running processes to track game and tool execution state.
 *
 * Polls system processes to detect when the active game or discovered tools
 * are running. Updates Redux state so the UI can reflect tool/game status
 * and enable features like exclusive tool handling.
 *
 * ## Public API
 * - `start()` - Begin polling (idempotent, safe to call multiple times)
 * - `end()` - Stop polling and cleanup timers
 *
 * ## Polling Behavior
 * - 2 second cadence when Vortex window is focused
 * - 5 second cadence when unfocused
 * - Non-overlapping: waits for current check to complete before scheduling next
 *
 * ## Process Matching
 * 1. Builds lookup maps by PID and normalized exe name (exeId)
 * 2. For each tracked executable (game + discovered tools):
 *    - Prefers exact full path match
 *    - Falls back to name-only match when paths unavailable (Windows)
 * 3. Tools only match Vortex child processes; games match any process
 *
 * ## Listening to Process Changes
 * ProcessMonitor writes to Redux state at `session.base.toolsRunning`. Other
 * parts of the application can listen for process start/stop events:
 *
 * **React components** - Use `useSelector` to automatically re-render:
 * ```typescript
 * import { makeExeId } from '../reducers/session';
 *
 * const toolsRunning = useSelector(state => state.session.base.toolsRunning);
 * const isRunning = toolsRunning[makeExeId(exePath)] !== undefined;
 * ```
 *
 * **Extensions** - Use `api.onStateChange` for callback-based notifications:
 * ```typescript
 * api.onStateChange(['session', 'base', 'toolsRunning'], (prev, current) => {
 *   // prev/current are { [exeId: string]: IRunningTool }
 *   const wasRunning = prev['game.exe'] !== undefined;
 *   const isRunning = current['game.exe'] !== undefined;
 *   if (wasRunning && !isRunning) {
 *     // Process stopped
 *   }
 * });
 * ```
 *
 * **One-time reads**:
 * ```typescript
 * const running = api.getState().session.base.toolsRunning;
 * ```
 *
 * The `IRunningTool` object contains: `{ pid: number, exclusive: boolean, started: number }`
 *
 * Note: Detection uses polling (2-5s cadence), so there may be a brief delay
 * between a process actually stopping and the state update.
 *
 * ## Platform Notes
 * On Windows, ps-list may not provide executable paths, triggering the
 * name-only fallback. This can cause false matches with basename collisions
 * (e.g., multiple tools named "launcher.exe").
 *
 * @example
 * ```typescript
 * const monitor = new ProcessMonitor(api);
 * monitor.start();
 * // ... on shutdown
 * monitor.end();
 * ```
 */
class ProcessMonitor {
  private mTimer: NodeJS.Timeout;
  private mStore: Redux.Store<IState>;
  private mWindow: BrowserWindow;
  private mActive: boolean = false;
  private mProcessProvider: IProcessProvider;

  /**
   * Creates a new ProcessMonitor instance.
   *
   * @param api - Extension API providing access to the Redux store for reading
   *              game/tool configuration and dispatching state updates.
   * @param processProvider - Optional process list provider for dependency injection.
   *                          Defaults to ps-list based implementation. Useful for
   *                          testing with mock process data.
   */
  constructor(
    api: IExtensionApi,
    processProvider: IProcessProvider = defaultProcessProvider,
  ) {
    this.mStore = api.store;
    this.mProcessProvider = processProvider;
  }

  /**
   * Starts the process monitoring loop.
   *
   * Idempotent: calling start() when already running has no effect.
   * If called after end(), restarts monitoring from scratch.
   *
   * In the renderer process, acquires a reference to the current BrowserWindow
   * to detect focus state for adaptive polling cadence (2s focused, 5s unfocused).
   */
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

  /**
   * Timer callback that initiates an async check and schedules the next one.
   *
   * Determines polling delay based on window focus state, then delegates to
   * doCheck(). Schedules next check after completion, adjusting delay to
   * maintain target cadence regardless of check duration.
   */
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

  /**
   * Core process matching logic.
   *
   * 1. Fetches current process list from the provider
   * 2. Builds lookup maps by PID (for validation) and by exeId (for matching)
   * 3. Updates state for the active game executable (considers detached processes)
   * 4. Updates state for each discovered tool (child processes only)
   *
   * The `update` closure handles the matching algorithm:
   * - Validates any cached PID is still the same process
   * - Prefers full path match over name-only match
   * - Falls back to name-only when all candidates lack path info (Windows)
   */
  private async doCheck(): Promise<void> {
    let processes: IProcessInfo[];
    try {
      processes = await this.mProcessProvider.list();
    } catch (err) {
      log("warn", "failed to list processes", err);
      return;
    }

    const hasPathSeparator = (value: string): boolean =>
      value.includes("/") || value.includes("\\");

    // Parse the executable path from a raw command line; handles quoted paths and
    // unquoted paths that may contain spaces (common on Linux/Steam paths).
    const getCommandPath = (proc: IProcessInfo): string | undefined => {
      const cmd = proc.cmd;
      if (!cmd) {
        return undefined;
      }
      const trimmed = cmd.trim();
      if (trimmed.startsWith('"')) {
        const end = trimmed.indexOf('"', 1);
        const quoted = end > 1 ? trimmed.slice(1, end) : undefined;
        return quoted !== undefined && hasPathSeparator(quoted)
          ? quoted
          : undefined;
      }

      const parts = trimmed.split(/\s+/).filter((part) => part.length > 0);
      if (parts.length === 0) {
        return undefined;
      }

      const exeName = proc.name.toLowerCase();
      let assembled = "";
      for (const part of parts) {
        assembled = assembled.length === 0 ? part : `${assembled} ${part}`;
        if (assembled.toLowerCase().endsWith(exeName)) {
          return hasPathSeparator(assembled) ? assembled : undefined;
        }
      }

      return hasPathSeparator(parts[0]) ? parts[0] : undefined;
    };

    // Prefer explicit process path; fall back to cmd-derived path when available.
    const getProcessPath = (proc: IProcessInfo): string | undefined =>
      proc.path ?? getCommandPath(proc);

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

  /**
   * Stops the process monitoring loop and releases resources.
   *
   * Clears any pending timer and marks the monitor as inactive. Safe to call
   * even when monitoring is not active (no-op if already stopped).
   *
   * Note: Does not dispatch any final state updates. Running tools will remain
   * marked as running in Redux state until the next start()/check() cycle or
   * explicit state reset.
   */
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
