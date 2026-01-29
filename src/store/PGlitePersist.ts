import type { IPersistor } from "../types/IExtensionContext";
import { log } from "../util/log";

import PromiseBB from "bluebird";
import type { PGlite } from "@electric-sql/pglite";
import { unknownToError } from "../shared/errors";

const SEPARATOR: string = "###";

export class DatabaseLocked extends Error {
  constructor() {
    super("Database is locked");
    this.name = this.constructor.name;
  }
}

async function openDB(dbPath: string): Promise<PGlite> {
  const { PGlite: PGliteClass } = await import("@electric-sql/pglite");
  const db = new PGliteClass(dbPath);
  await db.waitReady;

  // Create schema and table if they don't exist
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS vortex;
    CREATE TABLE IF NOT EXISTS vortex.state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  return db;
}

class PGlitePersist implements IPersistor {
  public static create(
    persistPath: string,
    tries: number = 10,
  ): PromiseBB<PGlitePersist> {
    return PromiseBB.resolve(openDB(persistPath))
      .then((db) => new PGlitePersist(db))
      .catch((err) => {
        if (tries === 0) {
          log("info", "failed to open pglite db", err);
          return PromiseBB.reject(new DatabaseLocked());
        } else {
          return PromiseBB.delay(500).then(() =>
            PGlitePersist.create(persistPath, tries - 1),
          );
        }
      });
  }

  private mDB: PGlite;

  constructor(db: PGlite) {
    this.mDB = db;
  }

  public close = this.restackingFunc((): PromiseBB<void> => {
    return PromiseBB.resolve(this.mDB.close());
  });

  public setResetCallback(cb: () => PromiseBB<void>): void {
    return undefined;
  }

  public getItem = this.restackingFunc((key: string[]): PromiseBB<string> => {
    const keyStr = key.join(SEPARATOR);
    return PromiseBB.resolve(
      this.mDB.query<{ value: string }>(
        "SELECT value FROM vortex.state WHERE key = $1",
        [keyStr],
      ),
    ).then((result) => {
      if (result.rows.length === 0) {
        log("debug", "getItem key not found", { keyStr });
        return PromiseBB.reject(new Error(`Key not found: ${keyStr}`));
      }
      return result.rows[0].value;
    });
  });

  public getAllKeys(): PromiseBB<string[][]> {
    return PromiseBB.resolve(
      this.mDB.query<{ key: string }>("SELECT key FROM vortex.state"),
    ).then((result) => {
      return result.rows.map((row) => row.key.split(SEPARATOR));
    });
  }

  public getAllKVs(
    prefix?: string,
  ): PromiseBB<Array<{ key: string[]; value: string }>> {
    // Always query all data and filter in JS to match LevelDB behavior exactly
    // This avoids any potential issues with SQL LIKE pattern matching
    return PromiseBB.resolve(
      this.mDB.query<{ key: string; value: string }>(
        "SELECT key, value FROM vortex.state",
      ),
    ).then((result) => {
      let rows = result.rows;

      // Filter by prefix if specified (matching LevelDB's gt/lt behavior)
      if (prefix !== undefined) {
        const prefixWithSep = `${prefix}${SEPARATOR}`;
        rows = rows.filter(
          (row) =>
            row.key > prefixWithSep &&
            row.key < `${prefixWithSep}~`, // ~ is ASCII 126, higher than most key characters
        );
      }

      log("info", "getAllKVs result", {
        prefix,
        totalRows: result.rows.length,
        filteredRows: rows.length,
        sampleKeys: rows.length > 0 ? rows.slice(0, 5).map((r) => r.key) : [],
      });

      // Debug: check for installationPath keys
      const installPathKeys = rows.filter((r) =>
        r.key.includes("installationPath"),
      );
      if (installPathKeys.length > 0) {
        log("info", "Found installationPath keys", {
          count: installPathKeys.length,
          samples: installPathKeys.slice(0, 3).map((r) => ({
            key: r.key,
            valueLength: r.value?.length,
            valuePreview: r.value?.substring(0, 50),
          })),
        });
      } else if (prefix === "user") {
        log("warn", "No installationPath keys found for user hive!");
      }

      return rows.map((row) => ({
        key: row.key.split(SEPARATOR),
        value: row.value,
      }));
    });
  }

  public setItem = this.restackingFunc(
    (statePath: string[], newState: string): PromiseBB<void> => {
      const keyStr = statePath.join(SEPARATOR);
      return PromiseBB.resolve(
        this.mDB.query(
          `INSERT INTO vortex.state (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = $2`,
          [keyStr, newState],
        ),
      ).then(() => undefined);
    },
  );

  public removeItem = this.restackingFunc(
    (statePath: string[]): PromiseBB<void> => {
      const keyStr = statePath.join(SEPARATOR);
      return PromiseBB.resolve(
        this.mDB.query("DELETE FROM vortex.state WHERE key = $1", [keyStr]),
      ).then(() => undefined);
    },
  );

  /**
   * Batch insert multiple items in a single transaction.
   * Used during migration from LevelDB.
   */
  public async batchInsert(
    items: Array<{ key: string[]; value: string }>,
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }

    // Use transaction for batch insert
    await this.mDB.transaction(async (tx) => {
      for (const item of items) {
        const keyStr = item.key.join(SEPARATOR);
        await tx.query(
          `INSERT INTO vortex.state (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = $2`,
          [keyStr, item.value],
        );
      }
    });
  }

  /**
   * Clear all data from the state table.
   * Used during re-migration.
   */
  public async clearAll(): Promise<void> {
    await this.mDB.query("DELETE FROM vortex.state");
  }

  private restackingFunc<T extends (...args: unknown[]) => any>(
    cb: T,
  ): (...args: Parameters<T>) => ReturnType<T> {
    return (...args: Parameters<T>): ReturnType<T> => {
      const stackErr = new Error();
      return cb(...args).catch((unknownErr) => {
        const err = unknownToError(unknownErr);
        err.stack = stackErr.stack;
        return PromiseBB.reject(err);
      });
    };
  }
}

export default PGlitePersist;
