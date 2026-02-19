import type { Serializable } from "../../shared/types/ipc";
import { log } from "../logging";
import type QueryRegistry from "./QueryRegistry";

interface WatchEntry {
  queryName: string;
  params: Record<string, unknown>;
  callback: (diff: WatchDiff) => void;
  previous: Record<string, Serializable>[] | undefined;
}

export interface WatchDiff {
  queryName: string;
  previous: Record<string, Serializable>[] | undefined;
  current: Record<string, Serializable>[];
}

/**
 * Watches query results for changes and calls callbacks on diffs.
 *
 * Runs in the main process. When queries are invalidated, re-executes
 * affected watched queries and compares JSON of old vs new results.
 */
class QueryWatcher {
  #mRegistry: QueryRegistry;
  #mWatches: Map<number, WatchEntry> = new Map();
  #mNextId: number = 0;

  constructor(registry: QueryRegistry) {
    this.#mRegistry = registry;
  }

  /**
   * Subscribe to changes for a query. Returns an unsubscribe function.
   *
   * Does an initial fetch to establish baseline (callback is NOT called
   * for the initial fetch).
   */
  public watch(
    queryName: string,
    params: Record<string, unknown>,
    callback: (diff: WatchDiff) => void,
  ): () => void {
    const id = this.#mNextId++;
    const entry: WatchEntry = {
      queryName,
      params,
      callback,
      previous: undefined,
    };
    this.#mWatches.set(id, entry);

    // Initial fetch for baseline (fire-and-forget)
    this.#mRegistry
      .executeQuery(queryName, params)
      .then((result) => {
        // Only set baseline if still subscribed
        const current = this.#mWatches.get(id);
        if (current !== undefined) {
          current.previous = result;
        }
      })
      .catch((err: unknown) => {
        log("warn", "QueryWatcher: initial fetch failed", {
          queryName,
          error: (err as Error).message,
        });
      });

    return () => {
      this.#mWatches.delete(id);
    };
  }

  /**
   * Called by QueryInvalidator when queries are invalidated.
   * Re-executes affected watched queries and diffs results.
   */
  public async onQueriesInvalidated(affectedQueries: string[]): Promise<void> {
    const affected = new Set(affectedQueries);

    for (const [id, entry] of this.#mWatches) {
      if (!affected.has(entry.queryName)) {
        continue;
      }

      try {
        const current = await this.#mRegistry.executeQuery(
          entry.queryName,
          entry.params,
        );

        const previousJson = JSON.stringify(entry.previous);
        const currentJson = JSON.stringify(current);

        if (previousJson !== currentJson) {
          const diff: WatchDiff = {
            queryName: entry.queryName,
            previous: entry.previous,
            current,
          };
          entry.previous = current;
          entry.callback(diff);
        }
      } catch (err) {
        log("warn", "QueryWatcher: re-fetch failed", {
          queryName: entry.queryName,
          error: (err as Error).message,
        });
      }
    }
  }
}

export default QueryWatcher;
