import type { IPersistor } from "../types/IExtensionContext";
import { log } from "../util/log";
import * as fs from "../util/fs";
import * as path from "path";

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

// Version marker for PGlite database format compatibility
// Increment this when upgrading PGlite to a version with incompatible storage format
const PGLITE_VERSION_MARKER = "pglite-v0.3";
const VERSION_FILE_NAME = ".vortex-pglite-version";

/**
 * Check if a directory exists
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.statAsync(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get the version marker from an existing PGlite database directory
 */
async function getDbVersionMarker(dbPath: string): Promise<string | null> {
  const versionFilePath = path.join(dbPath, VERSION_FILE_NAME);
  try {
    const version = await fs.readFileAsync(versionFilePath, "utf8");
    return version.trim();
  } catch {
    return null;
  }
}

/**
 * Write the version marker to a PGlite database directory
 */
async function writeDbVersionMarker(dbPath: string): Promise<void> {
  const versionFilePath = path.join(dbPath, VERSION_FILE_NAME);
  await fs.writeFileAsync(versionFilePath, PGLITE_VERSION_MARKER, {
    encoding: "utf8",
  });
}

/**
 * Backup an existing database directory by renaming it
 */
async function backupExistingDb(dbPath: string): Promise<void> {
  const timestamp = Date.now();
  const backupPath = `${dbPath}.backup.${timestamp}`;
  log("warn", "Backing up incompatible PGlite database", {
    from: dbPath,
    to: backupPath,
  });
  await fs.renameAsync(dbPath, backupPath);
}

/**
 * Check database compatibility and handle version mismatches.
 * This MUST be called before attempting to open PGlite, because
 * opening an incompatible database causes an uncatchable WASM trap
 * that crashes the entire process.
 */
async function ensureDbCompatibility(dbPath: string): Promise<void> {
  const dbExists = await directoryExists(dbPath);

  if (!dbExists) {
    // Fresh database, nothing to check
    log("debug", "PGlite database does not exist yet", { dbPath });
    return;
  }

  const existingVersion = await getDbVersionMarker(dbPath);

  if (existingVersion === PGLITE_VERSION_MARKER) {
    // Version matches, safe to open
    log("debug", "PGlite database version is compatible", {
      dbPath,
      version: existingVersion,
    });
    return;
  }

  if (existingVersion === null) {
    // No version marker - this could be:
    // 1. A database from before we added version markers
    // 2. A corrupted/incomplete database
    // Either way, it's potentially incompatible - backup and recreate
    log(
      "warn",
      "PGlite database has no version marker - may be from older incompatible version",
      { dbPath },
    );
    await backupExistingDb(dbPath);
    return;
  }

  // Version mismatch - backup and recreate
  log("warn", "PGlite database version mismatch - backing up and recreating", {
    dbPath,
    existingVersion,
    requiredVersion: PGLITE_VERSION_MARKER,
  });
  await backupExistingDb(dbPath);
}

async function openDB(dbPath: string): Promise<PGlite> {
  log("info", "Opening PGlite database", { dbPath });

  try {
    // IMPORTANT: Check compatibility BEFORE attempting to open
    // Opening an incompatible database causes an uncatchable WASM trap
    await ensureDbCompatibility(dbPath);

    // Ensure the database directory exists
    await fs.ensureDirAsync(dbPath);
    log("debug", "PGlite database directory ensured", { dbPath });

    const { PGlite: PGliteClass } = await import("@electric-sql/pglite");
    log("debug", "PGlite module loaded successfully");

    // Log WASM-related information for debugging
    log("debug", "PGlite environment info", {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
    });

    // Use the static create method which handles initialization properly
    log("debug", "Creating PGlite instance...");
    const db = await PGliteClass.create(dbPath);
    log("debug", "PGlite instance created and ready");

    // Write version marker after successful open
    await writeDbVersionMarker(dbPath);

    // Create schema and table if they don't exist
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS vortex;
      CREATE TABLE IF NOT EXISTS vortex.state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    log("debug", "PGlite schema initialized");

    return db;
  } catch (err) {
    log("error", "Failed to open PGlite database", {
      dbPath,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      // Additional debug info
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    });
    throw err;
  }
}

class PGlitePersist implements IPersistor {
  public static create(
    persistPath: string,
    tries: number = 10,
  ): PromiseBB<PGlitePersist> {
    return PromiseBB.resolve(openDB(persistPath))
      .then((db) => new PGlitePersist(db))
      .catch((err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isLockError = errMsg.includes("lock") || errMsg.includes("LOCK");

        if (tries === 0) {
          log("error", "failed to open pglite db after all retries", {
            error: errMsg,
            stack: err instanceof Error ? err.stack : undefined,
            persistPath,
          });
          // Only throw DatabaseLocked if it was actually a lock error
          if (isLockError) {
            return PromiseBB.reject(new DatabaseLocked());
          }
          return PromiseBB.reject(err);
        } else if (isLockError) {
          // Only retry for lock errors
          log("debug", "pglite db locked, retrying", { tries, error: errMsg });
          return PromiseBB.delay(500).then(() =>
            PGlitePersist.create(persistPath, tries - 1),
          );
        } else {
          // For non-lock errors, fail immediately with the real error
          log("error", "failed to open pglite db", {
            error: errMsg,
            stack: err instanceof Error ? err.stack : undefined,
            persistPath,
          });
          return PromiseBB.reject(err);
        }
      });
  }

  private mDB: PGlite;

  // Singleton instance for sharing with dev tools
  private static sInstance: PGlitePersist | null = null;

  constructor(db: PGlite) {
    this.mDB = db;
    PGlitePersist.sInstance = this;
  }

  /**
   * Get the shared PGlite database instance.
   * Used by dev tools like the SQL REPL to share the connection.
   */
  public static getSharedInstance(): PGlite | null {
    return PGlitePersist.sInstance?.mDB ?? null;
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
          (row) => row.key > prefixWithSep && row.key < `${prefixWithSep}~`, // ~ is ASCII 126, higher than most key characters
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
