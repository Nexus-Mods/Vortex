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

import { unknownToError } from "@vortex/shared";
import type { DiffOperation, Serializable } from "@vortex/shared/ipc";
import type { IPersistor, PersistorKey } from "@vortex/shared/state";

import { terminate } from "../errorHandling";
import { log } from "../logging";
import type LevelPersist from "./LevelPersist";
import type QueryInvalidator from "./QueryInvalidator";

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
    const newErr = new Error(`Failed to load application state ${hive}.${key.join(".")}`);
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
  #mLevelPersist: LevelPersist | undefined;
  #mInvalidator: QueryInvalidator | undefined;

  constructor() {
    // No store dependency - we receive diffs via IPC
  }

  /**
   * Set the LevelPersist instance and QueryInvalidator for dirty table tracking.
   */
  public setQueryInvalidator(levelPersist: LevelPersist, invalidator: QueryInvalidator): void {
    this.#mLevelPersist = levelPersist;
    this.#mInvalidator = invalidator;
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

  // Maximum operations bundled into a single bulk INSERT or DELETE.
  // Bounds failure granularity (a Write failure loses at most this many
  // operations of progress) while still collapsing typical Redux diffs
  // into a small number of LevelDB writes. Each set chunk uses 2*N
  // positional parameters; each remove chunk uses N. 256 keeps both
  // comfortably below any reasonable parameter limit.
  private static readonly BULK_CHUNK_SIZE = 256;

  /**
   * Process a batch of diff operations for a hive.
   *
   * Consecutive operations of the same type are coalesced into multi-row
   * INSERT or DELETE statements (chunked at BULK_CHUNK_SIZE) when the
   * persistor supports the optional bulk methods. Order is preserved across
   * type boundaries - a set->remove->set sequence on the same key still
   * resolves last-write-wins.
   */
  private async processOperations(
    hive: string,
    persistor: IPersistor,
    operations: DiffOperation[],
  ): Promise<void> {
    const levelPersist = this.#mLevelPersist;
    const invalidator = this.#mInvalidator;
    const useTransaction = levelPersist !== undefined && invalidator !== undefined;

    try {
      if (useTransaction) {
        await levelPersist.beginTransaction();
      }

      await this.applyOperationsInRuns(persistor, operations);

      if (useTransaction) {
        // Check dirty tables BEFORE commit (while transaction is active)
        const dirtyTables = await levelPersist.getDirtyTables();
        await levelPersist.commitTransaction();

        // Notify after commit
        if (dirtyTables.length > 0) {
          invalidator.notifyDirtyTables(dirtyTables);
        }
      }
    } catch (unknownError) {
      if (useTransaction) {
        try {
          await levelPersist.rollbackTransaction();
        } catch (rollbackErr) {
          log("warn", "Failed to rollback transaction", {
            error: unknownToError(rollbackErr).message,
          });
        }
      }

      const err = unknownToError(unknownError);

      // Handle disk full error (covers LevelDB and DuckDB/OS-level patterns)
      const diskFullPattern =
        /IO error: .*Append: cannot write|no space left on device|disk full|not enough space/i;
      if (
        diskFullPattern.test(err.message) ||
        (err.stack !== undefined && diskFullPattern.test(err.stack))
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
        terminate(new Error(`Failed to store application state: ${err.message}`));
      }
    }
  }

  /**
   * Walk the operation list, grouping consecutive same-type ops into runs
   * and dispatching each run to the bulk path when available.
   */
  private async applyOperationsInRuns(
    persistor: IPersistor,
    operations: DiffOperation[],
  ): Promise<void> {
    let i = 0;
    while (i < operations.length) {
      const opType = operations[i].type;
      let runEnd = i + 1;
      while (runEnd < operations.length && operations[runEnd].type === opType) {
        runEnd++;
      }
      const run = operations.slice(i, runEnd);
      if (opType === "set") {
        await this.applySetRun(persistor, run);
      } else {
        await this.applyRemoveRun(persistor, run);
      }
      i = runEnd;
    }
  }

  private async applySetRun(persistor: IPersistor, run: DiffOperation[]): Promise<void> {
    if (persistor.bulkSetItem !== undefined) {
      const bulk = persistor.bulkSetItem.bind(persistor);
      for (let start = 0; start < run.length; start += ReduxPersistorIPC.BULK_CHUNK_SIZE) {
        const chunk = run.slice(start, start + ReduxPersistorIPC.BULK_CHUNK_SIZE);
        await bulk(
          chunk.map((op) => ({
            key: op.path,
            value: this.serialize(op.value),
          })),
        );
      }
    } else {
      for (const op of run) {
        await persistor.setItem(op.path, this.serialize(op.value));
      }
    }
  }

  private async applyRemoveRun(persistor: IPersistor, run: DiffOperation[]): Promise<void> {
    if (persistor.bulkRemoveItem !== undefined) {
      const bulk = persistor.bulkRemoveItem.bind(persistor);
      for (let start = 0; start < run.length; start += ReduxPersistorIPC.BULK_CHUNK_SIZE) {
        const chunk = run.slice(start, start + ReduxPersistorIPC.BULK_CHUNK_SIZE);
        await bulk(chunk.map((op) => op.path));
      }
    } else {
      for (const op of run) {
        await persistor.removeItem(op.path);
      }
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
        (kvPair): kvPair is { key: PersistorKey; value: Serializable } => kvPair !== undefined,
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
