/**
 * Redux Persistor that receives diff operations via IPC from the renderer process.
 *
 * This replaces the store-subscription model where the persistor directly observed
 * the Redux store. Instead, the renderer computes state diffs and sends them to
 * main process via IPC for persistence.
 *
 * Key differences from the original ReduxPersistor:
 * - No Redux store dependency in constructor
 * - Receives pre-computed DiffOperations via IPC
 * - Provides hydration data to renderer on startup
 */

import type { DiffOperation, Serializable } from "@vortex/shared/ipc";
import type { IPersistor, PersistorKey } from "@vortex/shared/state";

import { unknownToError } from "@vortex/shared";

import { terminate } from "../errorHandling";
import { log } from "../logging";

/**
 * Helper to insert a value at a leaf position in a nested object.
 * Creates intermediate objects as needed.
 */
function insertValueAtLeaf<T extends Record<string, unknown>, V>(
  target: T,
  key: string[],
  value: V,
  hive: string,
) {
  try {
    key.reduce<Record<string, unknown>>((prev, keySegment, idx, fullKey) => {
      if (idx === fullKey.length - 1) {
        if (typeof prev !== "object") {
          log("error", "invalid application state", {
            key: fullKey.slice(0, idx).join("."),
            was: prev,
          });
          return { [keySegment]: value };
        }
        prev[keySegment] = value;
        return prev;
      } else {
        if (!prev[keySegment]) {
          prev[keySegment] = {};
        }
        return prev[keySegment] as Record<string, unknown>;
      }
    }, target);
  } catch (err) {
    const newErr = new Error(
      `Failed to load application state ${hive}.${key.join(".")}`,
    );
    if (err instanceof Error) {
      newErr.stack = err.stack;
    }
    throw newErr;
  }
}

/**
 * Factory function type for creating persistors on demand.
 * Used when receiving diffs for unknown hives (e.g., extension-registered hives).
 */
export type PersistorFactory = (hive: string) => IPersistor | undefined;

/**
 * ReduxPersistor that works via IPC instead of direct store subscription.
 * Receives diff operations from renderer and persists them to LevelDB.
 */
class ReduxPersistorIPC {
  private mPersistors: { [hive: string]: IPersistor } = {};
  private mUpdateQueue: Promise<void> = Promise.resolve();
  private mPersistorFactory: PersistorFactory | undefined;

  constructor() {
    // No store dependency - we receive diffs via IPC
  }

  /**
   * Set a factory function for creating persistors on demand.
   * This allows handling diffs for hives that weren't registered upfront
   * (e.g., extension-registered hives).
   */
  public setPersistorFactory(factory: PersistorFactory): void {
    this.mPersistorFactory = factory;
  }

  /**
   * Wait for all pending persistence operations to complete.
   */
  public finalizeWrite(): Promise<void> {
    return this.mUpdateQueue;
  }

  /**
   * Register a persistor for a specific hive.
   * Returns a promise that resolves with the hydration data for that hive.
   */
  public insertPersistor(
    hive: string,
    persistor: IPersistor,
  ): Promise<{ [key: string]: Serializable }> {
    return this.loadHydrationData(hive, persistor).then((data) => {
      this.mPersistors[hive] = persistor;
      persistor.setResetCallback(() =>
        this.loadHydrationData(hive, persistor).then(() => undefined),
      );
      return data;
    });
  }

  /**
   * Get hydration data for all registered hives.
   * Called by the main process to send initial state to renderer.
   */
  public async getAllHydrationData(): Promise<{
    [hive: string]: Serializable;
  }> {
    const result: { [hive: string]: Serializable } = {};

    for (const [hive, persistor] of Object.entries(this.mPersistors)) {
      try {
        result[hive] = await this.loadHydrationData(hive, persistor);
      } catch (err) {
        log("error", "Failed to load hydration data for hive", {
          hive,
          error: err,
        });
        result[hive] = {};
      }
    }

    return result;
  }

  /**
   * Apply diff operations received from the renderer process.
   * This is the main entry point for IPC-based persistence.
   */
  public applyDiffOperations(hive: string, operations: DiffOperation[]): void {
    let persistor = this.mPersistors[hive];

    // If we don't have a persistor for this hive, try to create one on demand
    if (persistor === undefined && this.mPersistorFactory !== undefined) {
      const newPersistor = this.mPersistorFactory(hive);
      if (newPersistor !== undefined) {
        log("info", "Created persistor on demand for hive", { hive });
        this.mPersistors[hive] = newPersistor;
        persistor = newPersistor;
      }
    }

    if (persistor === undefined) {
      log("warn", "Received diff for unknown hive (no factory available)", {
        hive,
      });
      return;
    }

    this.mUpdateQueue = this.mUpdateQueue
      .then(() => this.processOperations(hive, persistor, operations))
      .catch((unknownError) => {
        // Ensure errors don't break the queue
        const err = unknownToError(unknownError);
        log("error", "Failed to process persistence operations", {
          hive,
          error: err.message,
        });
      });
  }

  /**
   * Process a batch of diff operations for a hive.
   * Operations are processed sequentially to maintain order.
   */
  private async processOperations(
    hive: string,
    persistor: IPersistor,
    operations: DiffOperation[],
  ): Promise<void> {
    try {
      // Process operations sequentially to maintain order
      for (const op of operations) {
        await this.applyOperation(persistor, op);
      }
    } catch (unknownError) {
      const err = unknownToError(unknownError);

      // Handle disk full error
      if (
        err.message.match(/IO error: .*Append: cannot write/) !== null ||
        err.stack?.match(/IO error: .*Append: cannot write/) !== null
      ) {
        terminate(
          new Error(
            "There is not enough space on the disk. Vortex needs to quit now to " +
              "ensure you're not losing further work. Please free up some space, " +
              "then restart Vortex.",
          ),
        );
        // Retry on user ignore
        return this.processOperations(hive, persistor, operations);
      } else {
        terminate(
          new Error(`Failed to store application state: ${err.message}`),
          true,
        );
      }
    }
  }

  /**
   * Apply a single diff operation to the persistor.
   */
  private applyOperation(
    persistor: IPersistor,
    operation: DiffOperation,
  ): Promise<void> {
    if (operation.type === "set") {
      return Promise.resolve(
        persistor.setItem(operation.path, this.serialize(operation.value)),
      );
    } else {
      return Promise.resolve(persistor.removeItem(operation.path));
    }
  }

  /**
   * Load all persisted data for a hive.
   * Returns a nested object structure reconstructed from the flat key-value store.
   */
  private async loadHydrationData(
    hive: string,
    persistor: IPersistor,
  ): Promise<{ [key: string]: Serializable }> {
    let kvPairs: Array<{ key: PersistorKey; value: Serializable }>;

    if (persistor.getAllKVs !== undefined) {
      // Fast path: persistor can return all key-value pairs at once
      const allKvs = await persistor.getAllKVs();
      kvPairs = allKvs.map((kv: { key: PersistorKey; value: string }) => ({
        key: kv.key,
        value: this.deserialize(kv.value),
      }));
    } else {
      // Slow path: get all keys first, then fetch values individually
      const keys = await persistor.getAllKeys();
      const results = await Promise.all(
        keys.map(async (key) => {
          try {
            const value = await persistor.getItem(key);
            return { key, value: this.deserialize(value) };
          } catch (unknownError) {
            const err = unknownToError(unknownError);
            if (err.name === "NotFoundError") {
              log("error", "key missing from database", { key });
              return undefined;
            }
            throw err;
          }
        }),
      );
      // Filter out undefined values (keys that weren't found)
      kvPairs = results.filter(
        (kvPair): kvPair is { key: PersistorKey; value: Serializable } =>
          kvPair !== undefined,
      );
    }

    // Reconstruct nested object from flat key-value pairs
    const result: { [key: string]: Serializable } = {};
    kvPairs.forEach((pair) => {
      insertValueAtLeaf(result, pair.key, pair.value, hive);
    });
    return result;
  }

  private deserialize(input: string): Serializable {
    if (input === undefined || input.length === 0) {
      return "";
    }
    try {
      // JSON.parse returns any, but we know persisted data is Serializable
      return JSON.parse(input) as Serializable;
    } catch {
      return undefined;
    }
  }

  private serialize<T>(input: T): string {
    return JSON.stringify(input);
  }
}

export default ReduxPersistorIPC;
