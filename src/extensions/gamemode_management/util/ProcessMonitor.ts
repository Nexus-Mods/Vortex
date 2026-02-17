import { setToolPid, setToolStopped } from "../../../renderer/actions";
import { makeExeId } from "../../../reducers/session";
import type { IDiscoveredTool } from "../../../renderer/types/IDiscoveredTool";
import type { IExtensionApi } from "../../../renderer/types/IExtensionContext";
import type { IState } from "../../../renderer/types/IState";
import { log } from "../../../util/log";
import { currentGame, currentGameDiscovery } from "../../../util/selectors";
import { getSafe } from "../../../util/storeHelper";
import { setdefault } from "../../../util/util";

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
  private mIsFocused: boolean = true;
  private mUnsubscribeFocus: (() => void) | null = null;
  private mUnsubscribeBlur: (() => void) | null = null;
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

    // Track focus state via preload events in renderer process
    if (process.type === "renderer" && window?.api?.window) {
      this.mIsFocused = true; // Assume focused initially
      this.mUnsubscribeFocus = window.api.window.onFocus(() => {
        this.mIsFocused = true;
      });
      this.mUnsubscribeBlur = window.api.window.onBlur(() => {
        this.mIsFocused = false;
      });
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

    const delay = this.mIsFocused ? 2000 : 5000;
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
    // ─── Step 1: Fetch process list ───────────────────────────────────────────
    let processes: IProcessInfo[];
    try {
      processes = await this.mProcessProvider.list();
    } catch (err) {
      log("warn", "failed to list processes", err);
      return;
    }

    // ─── Step 2: Define path-extraction helpers ───────────────────────────────
    const hasPathSeparator = (value: string): boolean =>
      value.includes("/") || value.includes("\\");

    /**
     * Extracts the executable path from a process's raw command line string.
     *
     * Why this is needed:
     * - `proc.path` is often undefined on Windows (ps-list limitation)
     * - `proc.cmd` contains the full command line, but parsing it is non-trivial
     *
     * The command line can take several forms:
     * - Quoted path: `"C:\Program Files\Game\game.exe" --fullscreen`
     * - Unquoted path with spaces: `/home/user/Steam Games/game.exe --arg`
     * - Simple path: `game.exe` or `/usr/bin/game`
     *
     * Parsing strategy:
     * 1. If the command starts with a quote, extract the quoted portion
     * 2. Otherwise, split by whitespace and progressively reassemble parts
     *    until the assembled string ends with the known process name
     * 3. Final fallback: use the first whitespace-delimited token
     *
     * Only returns a path if it contains a path separator (/ or \), since
     * bare names like "game.exe" aren't useful for exact matching.
     *
     * @example
     * // Quoted path
     * cmd = '"C:\\Program Files\\Game\\game.exe" --fullscreen'
     * // Returns: "C:\\Program Files\\Game\\game.exe"
     *
     * @example
     * // Unquoted path with spaces (Linux/Steam)
     * cmd = '/home/user/Steam Games/game.exe --windowed'
     * name = 'game.exe'
     * // Reassembles: "/home/user/Steam" -> "/home/user/Steam Games/game.exe" (matches!)
     * // Returns: "/home/user/Steam Games/game.exe"
     *
     * @example
     * // No path separator (bare name)
     * cmd = 'game.exe --arg'
     * // Returns: undefined (not useful for path matching)
     */
    const getCommandPath = (proc: IProcessInfo): string | undefined => {
      const cmd = proc.cmd;
      if (!cmd) {
        return undefined;
      }

      // Step 2a: Trim leading/trailing whitespace
      const trimmed = cmd.trim();

      // Step 2b: Handle quoted paths - extract content between first pair of quotes
      if (trimmed.startsWith('"')) {
        const end = trimmed.indexOf('"', 1);
        const quoted = end > 1 ? trimmed.slice(1, end) : undefined;
        return quoted !== undefined && hasPathSeparator(quoted)
          ? quoted
          : undefined;
      }

      // Step 2c: Split into whitespace-delimited tokens
      const parts = trimmed.split(/\s+/).filter((part) => part.length > 0);
      if (parts.length === 0) {
        return undefined;
      }

      // Step 2d: Progressively reassemble tokens until we find one ending with the exe name
      // This handles unquoted paths with spaces like "/home/user/My Games/game.exe"
      const exeName = proc.name.toLowerCase();
      let assembled = "";
      for (const part of parts) {
        assembled = assembled.length === 0 ? part : `${assembled} ${part}`;
        if (assembled.toLowerCase().endsWith(exeName)) {
          return hasPathSeparator(assembled) ? assembled : undefined;
        }
      }

      // Step 2e: Fallback - return first token if it looks like a path
      return hasPathSeparator(parts[0]) ? parts[0] : undefined;
    };

    // Prefer explicit process path; fall back to cmd-derived path when available.
    const getProcessPath = (proc: IProcessInfo): string | undefined =>
      proc.path ?? getCommandPath(proc);

    // ─── Step 3: Build lookup maps ────────────────────────────────────────────

    // Step 3a: Map by PID for quick validation of cached tool PIDs (avoid stale PID reuse)
    const byPid: { [pid: number]: IProcessInfo } = processes.reduce(
      (prev, proc) => {
        prev[proc.pid] = proc;
        return prev;
      },
      {},
    );

    // Step 3b: Map by exeId (normalized lowercase basename) for name-based candidate lookup
    const byName: { [exeId: string]: IProcessInfo[] } = processes.reduce(
      (prev: { [exeId: string]: IProcessInfo[] }, proc) => {
        setdefault(prev, makeExeId(proc.name), []).push(proc);
        return prev;
      },
      {} as { [exeId: string]: IProcessInfo[] },
    );

    // ─── Step 4: Capture current state and Vortex PID ─────────────────────────
    const state = this.mStore.getState();
    const vortexPid = process.pid;

    // ─── Step 5: Define child-process ancestry check ──────────────────────────
    // Recursively walks the parent chain to determine if a process descends from Vortex.
    // Used to distinguish tools we launched vs. unrelated processes with the same name.
    const isChildProcessOfVortex = (
      proc: IProcessInfo,
      visited: Set<number>,
    ): boolean => {
      // Base case: no process or reached init (PID 0)
      if (proc === undefined || proc.ppid === 0) {
        return false;
      }
      // Cycle detection: avoid infinite loops from corrupted process trees
      if (visited.has(proc.ppid)) {
        return false;
      }
      visited.add(proc.ppid);
      // Success if direct child of Vortex, otherwise recurse up the tree
      return (
        proc.ppid === vortexPid ||
        isChildProcessOfVortex(byPid[proc.ppid], visited)
      );
    };

    // ─── Step 6: Define the update() matching closure ─────────────────────────
    // This closure matches a given exePath against running processes and updates
    // Redux state accordingly. It prefers full path matches but falls back to
    // name-only matching when path info is unavailable (common on Windows).
    //
    // Parameters:
    // - exePath: full path to the executable we're looking for
    // - exclusive: whether this tool should block other tools from running
    // - considerDetached: if true, match any process; if false, only match Vortex children
    const update = (
      exePath: string,
      exclusive: boolean,
      considerDetached: boolean,
    ) => {
      // Step 6a: Lookup current state
      // - knownRunning: what we previously recorded as running (may be stale)
      // - exeRunning: all processes with matching basename currently in the process list
      const exeId = makeExeId(exePath);
      const knownRunning = state.session.base.toolsRunning[exeId];
      const exeRunning = byName[exeId];

      // Step 6b: Early exit - no process with this name is running
      if (exeRunning === undefined) {
        if (knownRunning !== undefined) {
          this.mStore.dispatch(setToolStopped(exePath));
        }
        return;
      }

      // Step 6c: Validate cached PID - if we already track this tool, verify it's still valid
      if (knownRunning !== undefined) {
        const knownProc = byPid[knownRunning.pid];
        if (knownProc !== undefined) {
          // Step 6c-i: Process with cached PID still exists - but is it still "ours"?
          // For games (considerDetached=true): any process is valid, we're done
          // For tools (considerDetached=false): must still be a Vortex child process
          if (
            considerDetached ||
            isChildProcessOfVortex(knownProc, new Set())
          ) {
            return; // Still valid, no state change needed
          }
          // Step 6c-ii: Process exists but is no longer a child - fall through to re-match
          // This can happen if a tool spawns a subprocess and the original exits
        }
        // Step 6c-iii: Cached PID no longer exists (process exited) - fall through to find new match
      }

      // Step 6d: Build candidate list - filter by child status if required
      const candidates = considerDetached
        ? exeRunning
        : exeRunning.filter((proc) => isChildProcessOfVortex(proc, new Set()));

      // Step 6e: Enrich candidates with resolved paths (from proc.path or parsed from proc.cmd)
      const exePathLower = exePath.toLowerCase();
      const candidatesWithPath = candidates.map((proc) => ({
        proc,
        path: getProcessPath(proc),
      }));

      // Step 6f: Attempt exact path match (preferred - most reliable)
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

      // Step 6g: Fallback - name-only match when ALL candidates lack path info
      // This handles Windows where ps-list often cannot retrieve executable paths.
      // Warning: basename collisions (e.g., multiple "launcher.exe") cause false positives.
      if (
        candidatesWithPath.length > 0 &&
        candidatesWithPath.every((entry) => entry.path === undefined)
      ) {
        this.mStore.dispatch(
          setToolPid(exePath, candidatesWithPath[0].proc.pid, exclusive),
        );
        return;
      }

      // Step 6h: No match found - if we previously thought it was running, mark it stopped
      // This happens when:
      // - All candidates had paths, but none matched our target path (different exe with same name)
      // - Candidates existed but weren't child processes (and considerDetached=false)
      if (knownRunning !== undefined) {
        this.mStore.dispatch(setToolStopped(exePath));
      }
    };

    // ─── Step 7: Match the active game executable ─────────────────────────────
    // Games use considerDetached=true since they typically outlive Vortex's process tree
    // (user may close Vortex while game is running, then reopen Vortex).
    // Games are always marked exclusive=true to enable features like deploy-on-exit.
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

    // ─── Step 8: Match each discovered tool ───────────────────────────────────
    // Tools use considerDetached=false - we only want to track tools that Vortex launched.
    // This prevents false matches when the user runs the same tool outside of Vortex.
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

    // Unsubscribe from focus events
    this.mUnsubscribeFocus?.();
    this.mUnsubscribeBlur?.();
    this.mUnsubscribeFocus = null;
    this.mUnsubscribeBlur = null;

    log("debug", "stop process monitor");
  }
}

export default ProcessMonitor;
