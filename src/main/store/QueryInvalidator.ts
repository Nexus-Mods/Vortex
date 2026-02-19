import { BrowserWindow } from "electron";

import { log } from "../logging";
import type QueryRegistry from "./QueryRegistry";
import type QueryWatcher from "./QueryWatcher";

/**
 * Connects the write path to query invalidation notifications.
 *
 * When dirty tables are reported (after a transaction commit),
 * maps them to affected queries via QueryRegistry and sends
 * invalidation events to all renderer windows.
 */
class QueryInvalidator {
  #mRegistry: QueryRegistry;
  #mWatcher: QueryWatcher | undefined;
  #mPendingTables: Set<string> = new Set();
  #mDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  #mDebounceMs: number;

  constructor(registry: QueryRegistry, debounceMs: number = 16) {
    this.#mRegistry = registry;
    this.#mDebounceMs = debounceMs;
  }

  /**
   * Set a QueryWatcher to be notified when queries are invalidated.
   */
  public setWatcher(watcher: QueryWatcher): void {
    this.#mWatcher = watcher;
  }

  /**
   * Notify that tables have been modified.
   * Debounces notifications to batch rapid writes.
   */
  public notifyDirtyTables(
    dirtyTables: Array<{ database: string; table: string; type: string }>,
  ): void {
    if (!this.#mRegistry.hasQueries) {
      return;
    }

    for (const dt of dirtyTables) {
      // Add both qualified (db.table) and unqualified (table) names
      this.#mPendingTables.add(`${dt.database}.${dt.table}`);
      this.#mPendingTables.add(dt.table);
    }

    if (this.#mDebounceTimer !== undefined) {
      clearTimeout(this.#mDebounceTimer);
    }

    this.#mDebounceTimer = setTimeout(() => {
      this.#flush();
    }, this.#mDebounceMs);
  }

  #flush(): void {
    if (this.#mPendingTables.size === 0) {
      return;
    }

    const tables = [...this.#mPendingTables];
    this.#mPendingTables.clear();
    this.#mDebounceTimer = undefined;

    const affectedQueries = this.#mRegistry.getAffectedQueries(tables);
    if (affectedQueries.length === 0) {
      return;
    }

    log("debug", "query-invalidator: notifying renderer", {
      tables,
      queries: affectedQueries,
    });

    // Send to all renderer windows
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed() && window.webContents !== undefined) {
        window.webContents.send("query:invalidated", affectedQueries);
      }
    }

    // Notify watcher (fire-and-forget)
    this.#mWatcher?.onQueriesInvalidated(affectedQueries).catch((err) => {
      log("warn", "QueryWatcher notification failed", err);
    });
  }
}

export default QueryInvalidator;
