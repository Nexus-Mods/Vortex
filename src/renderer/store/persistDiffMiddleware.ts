/**
 * Redux middleware that computes state diffs and sends them to the main process
 * for persistence via the preload API.
 *
 * This middleware replaces the need for the main process to hold the Redux store.
 * Instead, the renderer owns the store and sends only the changed portions to main
 * for persistence to LevelDB.
 */

import type { Middleware, MiddlewareAPI, Dispatch, AnyAction } from "redux";

import type { DiffOperation } from "@vortex/shared/ipc";
import type { PersistedHive } from "@vortex/shared/state";
import type { IState } from "../types/IState";

import { getErrorMessageOrDefault } from "@vortex/shared";
import { log } from "../util/log";
import { computeStateDiff } from "./stateDiff";

/**
 * Core hives that are always persisted to LevelDB.
 * Additional hives can be discovered from the database at startup.
 */
const CORE_HIVES: PersistedHive[] = [
  "app",
  "settings",
  "persistent",
  "confidential",
  "user",
];

/**
 * Dynamic set of hives to persist. Starts with core hives,
 * additional hives can be added when discovered from hydration data.
 */
const persistedHives: Set<string> = new Set(CORE_HIVES);

/**
 * Add additional hives to be persisted.
 * Called when hydration data includes hives not in the core set.
 *
 * @param hives - Array of hive names to add
 */
export function addPersistedHives(hives: string[]): void {
  for (const hive of hives) {
    persistedHives.add(hive);
  }
}

/**
 * Get the current list of persisted hives.
 */
export function getPersistedHives(): string[] {
  return [...persistedHives];
}

/**
 * Minimum time between diff sends to avoid IPC flood.
 * Diffs are batched and sent after this delay.
 */
const DEBOUNCE_MS = 100;

type PendingDiffs = {
  [H in PersistedHive]?: DiffOperation[];
};

/**
 * Serialize a diff operation's value for IPC transport.
 * State values may contain non-serializable objects (functions, EventEmitters, etc.)
 * which would cause "An object could not be cloned" errors in IPC.
 */
function serializeOperation(op: DiffOperation): DiffOperation {
  if (op.type === "remove") {
    return op;
  }
  // Treat undefined values as removals - they can't be serialized
  if (op.value === undefined) {
    return { type: "remove", path: op.path };
  }
  try {
    // JSON stringify/parse strips non-serializable values (functions, undefined, symbols)
    const serialized = JSON.stringify(op.value);
    // JSON.stringify returns undefined for undefined/function/symbol values
    if (serialized === undefined) {
      return { type: "remove", path: op.path };
    }
    return {
      ...op,
      value: JSON.parse(serialized),
    };
  } catch (err) {
    const message = getErrorMessageOrDefault(err);
    // If serialization fails, log and skip this value
    log("warn", "Failed to serialize diff operation value", {
      path: op.path.join("."),
      error: message,
    });
    // Return a remove operation instead - we can't persist non-serializable data
    return { type: "remove", path: op.path };
  }
}

type PersistApi = {
  sendDiff: (hive: PersistedHive, operations: DiffOperation[]) => void;
};

/**
 * Get the persist API lazily - it may not be available at module load time
 * but will be available by the time we need to actually use it.
 */
function getPersistApi(): PersistApi | null {
  if (typeof window !== "undefined" && window.api?.persist) {
    return window.api.persist;
  }
  return null;
}

/**
 * Creates a middleware that computes state diffs and sends them to main for persistence.
 *
 * @param getPersistApiOverride - Optional function to get the persistence API (for testing).
 *                                If not provided, uses the global window.api.persist.
 * @returns Redux middleware
 */
export function createPersistDiffMiddleware(
  getPersistApiOverride?: () => PersistApi | null,
): Middleware {
  // Use override or default lazy lookup
  const getApi = getPersistApiOverride ?? getPersistApi;

  // Track previous state for diff computation
  let previousState: IState | null = null;

  // Batch pending diffs to reduce IPC calls
  let pendingDiffs: PendingDiffs = {};
  let flushTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Flush all pending diffs to main process
   */
  const flushDiffs = () => {
    const persistApi = getApi();
    if (persistApi === null) {
      return;
    }

    for (const [hive, operations] of Object.entries(pendingDiffs) as [
      PersistedHive,
      DiffOperation[],
    ][]) {
      if (operations.length > 0) {
        // Serialize operations to ensure IPC compatibility
        const serializedOps = operations.map(serializeOperation);
        persistApi.sendDiff(hive, serializedOps);
      }
    }
    pendingDiffs = {};
    flushTimeout = null;
  };

  /**
   * Schedule a flush of pending diffs
   */
  const scheduleFlush = () => {
    if (flushTimeout === null) {
      flushTimeout = setTimeout(flushDiffs, DEBOUNCE_MS);
    }
  };

  /**
   * Add diff operations to the pending queue
   */
  const queueDiffs = (hive: PersistedHive, operations: DiffOperation[]) => {
    if (pendingDiffs[hive] === undefined) {
      pendingDiffs[hive] = [];
    }
    pendingDiffs[hive].push(...operations);
    scheduleFlush();
  };

  const middleware: Middleware =
    (store: MiddlewareAPI<Dispatch<AnyAction>, IState>) =>
    (next: Dispatch<AnyAction>) =>
    (action: AnyAction) => {
      // Let the action process first
      const result = next(action);

      // Skip if no persist API available
      if (getApi() === null) {
        return result;
      }

      // Skip hydration actions - these come from persistence, don't re-persist
      if (action.type === "__hydrate" || action.type === "__hydrate_replace") {
        // Update previous state without computing diff
        previousState = store.getState();
        return result;
      }

      const newState = store.getState();

      // Initialize previous state on first action
      if (previousState === null) {
        previousState = newState;
        return result;
      }

      // Compute and queue diffs for each persisted hive
      for (const hive of persistedHives) {
        const oldHive = previousState[hive as keyof IState];
        const newHive = newState[hive as keyof IState];

        // Skip if hive hasn't changed (reference equality)
        if (oldHive === newHive) {
          continue;
        }

        // Compute diff for this hive
        const operations = computeStateDiff(oldHive, newHive);
        if (operations.length > 0) {
          queueDiffs(hive as PersistedHive, operations);
        }
      }

      // Update previous state for next comparison
      previousState = newState;

      return result;
    };

  return middleware;
}

/**
 * Default middleware instance that uses window.api.persist if available.
 * This is a convenience export for cases where the preload API is available globally.
 * The API lookup is lazy, so it will find window.api.persist even if it wasn't
 * available when this module was first loaded.
 */
export const persistDiffMiddleware = createPersistDiffMiddleware();
