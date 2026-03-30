import type { DuckDBConnection } from "@duckdb/node-api";

import { log } from "../logging";
import type QueryInvalidator from "../store/QueryInvalidator";
import type { IStoreScanner, IStoreGameEntry } from "./IStoreScanner";

type SettledResult<T> =
  | { status: "fulfilled"; value: T }
  | { status: "rejected"; reason: unknown };

/**
 * A Promise.allSettled-compatible helper that works even when the global
 * Promise has been patched (e.g. by turbowalk's bluebird integration).
 *
 * turbowalk replaces global Promise with bluebird, and bluebird's allSettled
 * returns bluebird inspection objects rather than plain {status, value} objects.
 * This helper builds plain result objects by wrapping each promise individually.
 */
async function safeAllSettled<T>(
  promises: Array<Promise<T>>,
): Promise<Array<SettledResult<T>>> {
  return Promise.all(
    promises.map((p) =>
      p.then(
        (value: T): SettledResult<T> => ({ status: "fulfilled", value }),
        (reason: unknown): SettledResult<T> => ({ status: "rejected", reason }),
      ),
    ),
  );
}

/**
 * Row shape for the store_games DuckDB table.
 */
interface StoreGameRow {
  store_type: string;
  store_id: string;
  install_path: string;
  name: string | null;
  store_metadata: string | null;
}

/**
 * Orchestrates all store scanners and writes results to DuckDB.
 *
 * Runs scanners in parallel. Each scanner failure is isolated — one store
 * failing doesn't block others. Results are written to the `store_games`
 * table, and the QueryInvalidator is notified so watchers react.
 */
export class DiscoveryCoordinator {
  readonly #scanners: IStoreScanner[];
  readonly #connection: DuckDBConnection;
  readonly #invalidator: QueryInvalidator;
  #running: boolean = false;

  constructor(
    scanners: IStoreScanner[],
    connection: DuckDBConnection,
    invalidator: QueryInvalidator,
  ) {
    this.#scanners = scanners;
    this.#connection = connection;
    this.#invalidator = invalidator;
  }

  /**
   * Run all store scanners and write results to DuckDB.
   * Only one scan runs at a time; overlapping calls are ignored.
   */
  public async runDiscovery(): Promise<void> {
    if (this.#running) {
      log("debug", "discovery: skipping (already running)");
      return;
    }

    this.#running = true;

    try {
      const results = await safeAllSettled(
        this.#scanners.map(async (scanner) => {
          if (await scanner.isAvailable()) {
            const games = await scanner.scan();
            return { storeType: scanner.storeType, games };
          }
          return { storeType: scanner.storeType, games: [] as IStoreGameEntry[] };
        }),
      );

      for (const result of results) {
        if (result.status === "rejected") {
          log("warn", "discovery: scanner failed", {
            error: String(result.reason),
          });
          continue;
        }

        const { storeType, games } = result.value;
        await this.#writeResults(storeType, games);
      }

      // Notify the query system that store_games changed
      this.#invalidator.notifyDirtyTables([
        { database: "memory", table: "store_games", type: "UPDATE" },
      ]);

      log("info", "discovery: completed", {
        scanners: this.#scanners.length,
      });
    } finally {
      this.#running = false;
    }
  }

  async #writeResults(
    storeType: string,
    games: IStoreGameEntry[],
  ): Promise<void> {
    // Delete previous entries for this store type
    await this.#connection.run(
      "DELETE FROM store_games WHERE store_type = ?",
      [storeType],
    );

    // Insert new entries with bound parameters.
    for (const game of games) {
      if (!game.storeId || !game.installPath) {
        log("debug", "discovery: skipping entry with missing data", {
          storeType,
          storeId: game.storeId,
          installPath: game.installPath,
        });
        continue;
      }
      const name = game.name ?? "";
      const metadata = game.metadata ? JSON.stringify(game.metadata) : "";
      await this.#connection.run(
        `INSERT INTO store_games (store_type, store_id, install_path, name, store_metadata)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (store_type, store_id) DO UPDATE SET
           install_path = EXCLUDED.install_path,
           name = EXCLUDED.name,
           store_metadata = EXCLUDED.store_metadata`,
        [storeType, game.storeId, game.installPath, name, metadata],
      );
    }

    log("debug", "discovery: wrote results", {
      storeType,
      count: games.length,
    });
  }
}
