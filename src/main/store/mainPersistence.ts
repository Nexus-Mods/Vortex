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
import type { Serializable } from "@vortex/shared/ipc";

import { getErrorMessageOrDefault } from "@vortex/shared";

import type LevelPersist from "./LevelPersist";

import { log } from "../logging";
import { setupPersistenceIPC } from "./persistenceIPC";
import ReduxPersistorIPC from "./ReduxPersistorIPC";
import SubPersistor from "./SubPersistor";

let mainPersistor: ReduxPersistorIPC | undefined;
let levelPersist: LevelPersist | undefined;

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

  return mainPersistor;
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

  try {
    const subPersistor = new SubPersistor(levelPersist, hive);
    const value = await subPersistor.getItem(path);
    if (value === undefined || value === "") {
      return undefined;
    }
    return JSON.parse(value) as T;
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
