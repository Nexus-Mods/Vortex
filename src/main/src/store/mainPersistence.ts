/**
 * Main process persistence setup.
 *
 * In the new architecture:
 * - Renderer owns the Redux store and ExtensionManager
 * - Main process ONLY handles persistence (receives diffs via IPC, persists to LevelDB)
 * - Main does not need to know about extensions or reducers
 *
 * The main process:
 * 1. Sets up LevelDB connection
 * 2. Receives state diffs from renderer via IPC
 * 3. Persists diffs to LevelDB
 * 4. Provides hydration data to renderer
 */
import type { DiffOperation, Serializable } from "@vortex/shared/ipc";
import type { PersistedHive } from "@vortex/shared/state";

import { getErrorMessageOrDefault } from "@vortex/shared";
import { BrowserWindow } from "electron";
import * as path from "node:path";

import type LevelPersist from "./LevelPersist";

import { log } from "../logging";
import DuckDBSingleton from "./DuckDBSingleton";
import QueryInvalidator from "./QueryInvalidator";
import QueryRegistry from "./QueryRegistry";
import QueryWatcher from "./QueryWatcher";
import { setupPersistenceIPC } from "./persistenceIPC";
import type { ParsedQuery } from "./queryParser";
import { parseAllQueries } from "./queryParser";
import ReduxPersistorIPC from "./ReduxPersistorIPC";
import SubPersistor from "./SubPersistor";
import { Database } from "./Database";
import { getVortexPath } from "../getVortexPath";

let mainPersistor: ReduxPersistorIPC | undefined;
let levelPersist: LevelPersist | undefined;
let queryRegistry: QueryRegistry | undefined;
let queryInvalidator: QueryInvalidator | undefined;
let database: Database | undefined;

/**
 * Get the Database instance for typed model access.
 * Available after the query system initializes (async).
 */
export function getDatabase(): Database | undefined {
  return database;
}

/**
 * Initialize the main process persistence system.
 *
 * @param levelPersistor - The LevelPersist instance connected to the state database
 */
export function initMainPersistence(
  levelPersistor: LevelPersist,
): ReduxPersistorIPC {
  if (mainPersistor !== undefined) {
    return mainPersistor;
  }

  levelPersist = levelPersistor;
  mainPersistor = new ReduxPersistorIPC();

  // Set up factory to create persistors on demand for unknown hives
  // (e.g., extension-registered hives that main doesn't know about)
  mainPersistor.setPersistorFactory((hive: string) => {
    if (levelPersist === undefined) {
      return undefined;
    }
    return new SubPersistor(levelPersist, hive);
  });

  // Set up IPC handlers to receive diffs from renderer
  setupPersistenceIPC(mainPersistor);

  // Set up the query system (async, non-blocking)
  initQuerySystem(levelPersistor).catch((err) => {
    log("warn", "Failed to initialize query system", {
      error: getErrorMessageOrDefault(err),
    });
  });

  return mainPersistor;
}

/**
 * Initialize the reactive query system.
 * Creates QueryRegistry, QueryInvalidator, and sets up IPC handlers.
 */
async function initQuerySystem(levelPersistor: LevelPersist): Promise<void> {
  const singleton = DuckDBSingleton.getInstance();
  if (!singleton.isInitialized) {
    log("warn", "DuckDBSingleton not initialized, skipping query system");
    return;
  }

  // Create a dedicated connection for query execution
  const queryConnection = await singleton.createConnection();

  // Parse all SQL query files
  const queriesDir = path.join(getVortexPath("base"), "queries");
  let queries: ParsedQuery[];
  try {
    queries = parseAllQueries(queriesDir);
  } catch (err) {
    log("warn", "No query files found or parse error", {
      dir: queriesDir,
      error: getErrorMessageOrDefault(err),
    });
    return;
  }

  if (queries.length === 0) {
    log("debug", "No queries found, skipping query system initialization");
    return;
  }

  // Initialize registry
  queryRegistry = new QueryRegistry(queryConnection);
  await queryRegistry.initialize(queries);

  // Create invalidator and wire to persistor
  queryInvalidator = new QueryInvalidator(queryRegistry);
  mainPersistor?.setQueryInvalidator(levelPersistor, queryInvalidator);

  // Create Database instance for typed model access
  database = new Database(levelPersistor, queryInvalidator);

  // Create watcher and wire to invalidator
  const queryWatcher = new QueryWatcher(queryRegistry);
  queryInvalidator.setWatcher(queryWatcher);

  log("info", "Query system initialized", {
    queryCount: queryRegistry.getQueryNames().length,
  });
}

/**
 * Register a hive for persistence.
 * Creates a SubPersistor for the hive using the LevelDB backend.
 *
 * @param hive - The hive name (e.g., "settings", "persistent")
 * @returns Promise resolving to the hydration data for this hive
 */
export function registerHive(
  hive: string,
): Promise<{ [key: string]: Serializable }> {
  if (mainPersistor === undefined || levelPersist === undefined) {
    return Promise.reject(
      new Error(
        "Main persistence not initialized. Call initMainPersistence() first.",
      ),
    );
  }

  const subPersistor = new SubPersistor(levelPersist, hive);
  return mainPersistor.insertPersistor(hive, subPersistor);
}

/**
 * Get the main persistor instance.
 */
export function getMainPersistor(): ReduxPersistorIPC | undefined {
  return mainPersistor;
}

/**
 * Write diff operations to LevelDB and push the changes to all renderer windows.
 *
 * Use this (instead of writing to LevelPersist directly) whenever main-process code
 * needs to update Redux-persisted state. The renderer applies the operations via
 * __persist_push, which is excluded from persistDiffMiddleware so there is no
 * feedback loop.
 *
 * @param hive - The persisted hive to update (e.g. "settings", "persistent")
 * @param operations - Diff operations to apply
 */
export async function pushStateToRenderer(
  hive: PersistedHive,
  operations: DiffOperation[],
): Promise<void> {
  if (mainPersistor === undefined || levelPersist === undefined) {
    log("warn", "pushStateToRenderer called before persistence is initialized");
    return;
  }

  mainPersistor.applyDiffOperations(hive, operations);
  // Wait for the queue to drain so the data is on disk before notifying the renderer
  await mainPersistor.finalizeWrite();

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("persist:push", hive, operations);
    }
  }
}

/**
 * Wait for all pending persistence operations to complete.
 */
export function finalizeMainWrite(): Promise<void> {
  if (mainPersistor === undefined) {
    return Promise.resolve();
  }
  return mainPersistor.finalizeWrite();
}

/**
 * Close the persistence system.
 */
export async function closeMainPersistence(): Promise<void> {
  if (mainPersistor !== undefined) {
    await mainPersistor.finalizeWrite();
  }
  if (levelPersist !== undefined) {
    await levelPersist.close();
  }
  mainPersistor = undefined;
  levelPersist = undefined;
}

/**
 * Read a value directly from the persisted state.
 * Used by main process to read initial settings before renderer is ready.
 *
 * @param hive - The hive name (e.g., "settings")
 * @param path - The path within the hive (e.g., ["window"])
 * @returns Promise resolving to the value, or undefined if not found
 */
export async function readPersistedValue<T>(
  hive: string,
  path: string[],
): Promise<T | undefined> {
  if (levelPersist === undefined) {
    return undefined;
  }

  // First, try a direct read — works for leaf values stored at the exact key
  try {
    const subPersistor = new SubPersistor(levelPersist, hive);
    const value = await subPersistor.getItem(path);
    if (value !== undefined && value !== "") {
      return JSON.parse(value) as T;
    }
    return undefined;
  } catch {
    // Direct read failed (key not found). The value may be a non-leaf node
    // whose children are stored as separate leaf keys (e.g. the diff-based
    // persistence writes "settings###window###customTitlebar" rather than
    // "settings###window"). Reconstruct the object from all matching leaf keys.
  }

  try {
    const prefix = [hive, ...path].join("###");
    const kvs = await levelPersist.getAllKVs(prefix);
    if (kvs.length === 0) {
      return undefined;
    }

    const pathDepth = path.length + 1; // +1 for the hive prefix
    const result: Record<string, unknown> = {};
    for (const { key, value } of kvs) {
      const remainingKey = key.slice(pathDepth);
      if (remainingKey.length === 0) {
        continue;
      }

      let current: Record<string, unknown> = result;
      for (let i = 0; i < remainingKey.length - 1; i++) {
        if (current[remainingKey[i]] === undefined) {
          current[remainingKey[i]] = {};
        }
        current = current[remainingKey[i]] as Record<string, unknown>;
      }

      try {
        current[remainingKey[remainingKey.length - 1]] = JSON.parse(value);
      } catch {
        current[remainingKey[remainingKey.length - 1]] = value;
      }
    }

    return result as T;
  } catch (err) {
    const message = getErrorMessageOrDefault(err);
    log("warn", "Could not read persisted value", {
      hive,
      path,
      error: message,
    });
    return undefined;
  }
}

/**
 * Write a value directly to the persisted state.
 * Used by main process to persist values before renderer is ready.
 *
 * @param hive - The hive name (e.g., "app")
 * @param path - The path within the hive (e.g., ["instanceId"])
 * @param value - The value to persist
 */
export async function writePersistedValue<T>(
  hive: string,
  path: string[],
  value: T,
): Promise<void> {
  if (levelPersist === undefined) {
    return;
  }

  try {
    const subPersistor = new SubPersistor(levelPersist, hive);
    await subPersistor.setItem(path, JSON.stringify(value));
  } catch (err) {
    const message = getErrorMessageOrDefault(err);
    log("warn", "Could not write persisted value", {
      hive,
      path,
      error: message,
    });
  }
}

/**
 * Read all hydration data for a specific hive.
 * Used to get initial state for a hive before renderer is ready.
 *
 * @param hive - The hive name
 * @returns Promise resolving to the hive data, or empty object if not found
 */
export async function readHiveData(
  hive: string,
): Promise<{ [key: string]: Serializable }> {
  if (mainPersistor === undefined) {
    return {};
  }

  // If the hive is already registered, get data from persistor
  const persistor = mainPersistor;
  try {
    // This will load the data if not already loaded
    const subPersistor = new SubPersistor(levelPersist, hive);
    return await persistor.insertPersistor(hive, subPersistor);
  } catch (err) {
    const message = getErrorMessageOrDefault(err);
    log("warn", "Could not read hive data", { hive, error: message });
    return {};
  }
}

/**
 * Get all hive names that have persisted data in LevelDB.
 * This allows discovering unknown hives that were previously persisted.
 *
 * @returns Promise resolving to array of hive names
 */
export async function getPersistedHives(): Promise<string[]> {
  if (levelPersist === undefined) {
    return [];
  }

  try {
    return await levelPersist.getPersistedHives();
  } catch (err) {
    const message = getErrorMessageOrDefault(err);
    log("warn", "Could not get persisted hives", { error: message });
    return [];
  }
}

/**
 * Register all hives found in the database and return their hydration data.
 * This auto-discovers and registers any hives that have persisted data.
 *
 * @returns Promise resolving to hydration data for all discovered hives
 */
export async function registerAllPersistedHives(): Promise<{
  [hive: string]: Serializable;
}> {
  if (mainPersistor === undefined || levelPersist === undefined) {
    return {};
  }

  const hives = await getPersistedHives();
  log("info", "Discovered persisted hives", { hives });

  const result: { [hive: string]: Serializable } = {};

  for (const hive of hives) {
    try {
      const subPersistor = new SubPersistor(levelPersist, hive);
      result[hive] = await mainPersistor.insertPersistor(hive, subPersistor);
    } catch (err) {
      const message = getErrorMessageOrDefault(err);
      log("warn", "Could not register hive", { hive, error: message });
      result[hive] = {};
    }
  }

  return result;
}
