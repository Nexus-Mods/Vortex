/**
 * Migration module for transitioning from LevelDB to PGlite storage.
 *
 * This module handles:
 * 1. First-time migration from existing LevelDB data
 * 2. Re-migration when an older Vortex version has written new data to LevelDB
 * 3. Creating fresh PGlite storage when no LevelDB exists
 */

import { log } from "../util/log";
import * as fs from "../util/fs";
import * as path from "path";

import PromiseBB from "bluebird";
import encode from "encoding-down";
import type leveldownT from "leveldown";
import * as levelup from "levelup";

import PGlitePersist from "./PGlitePersist";

const SEPARATOR: string = "###";
const MIGRATION_TIMESTAMP_KEY = "__pglite_migration_timestamp__";
const BATCH_SIZE = 1000;

// Time buffer (in ms) to account for clock differences
const MIGRATION_TIME_BUFFER = 60000; // 60 seconds

interface LevelDB {
  db: levelup.LevelUp;
  close: () => Promise<void>;
}

/**
 * Open LevelDB for reading during migration.
 */
async function openLevelDB(dbPath: string): Promise<LevelDB> {
  return new Promise((resolve, reject) => {
    const leveldown: typeof leveldownT = require("leveldown");
    const db = levelup.default(
      encode(leveldown(dbPath)),
      { keyEncoding: "utf8", valueEncoding: "utf8" },
      (err) => {
        if (err !== null) {
          return reject(err);
        }
        return resolve({
          db,
          close: () =>
            new Promise<void>((res, rej) => {
              db.close((closeErr) => (closeErr ? rej(closeErr) : res()));
            }),
        });
      },
    );
  });
}

/**
 * Read all key-value pairs from LevelDB.
 */
async function readAllFromLevelDB(
  db: levelup.LevelUp,
): Promise<Array<{ key: string[]; value: string }>> {
  return new Promise((resolve, reject) => {
    const kvs: Array<{ key: string[]; value: string }> = [];

    db.createReadStream()
      .on("data", (data: { key: string; value: string }) => {
        // Skip the migration timestamp key
        if (data.key !== MIGRATION_TIMESTAMP_KEY) {
          kvs.push({ key: data.key.split(SEPARATOR), value: data.value });
        }
      })
      .on("error", (error: Error) => {
        reject(error);
      })
      .on("close", () => {
        resolve(kvs);
      });
  });
}

/**
 * Get the migration timestamp from LevelDB.
 */
async function getMigrationTimestamp(
  db: levelup.LevelUp,
): Promise<number | null> {
  return new Promise((resolve) => {
    db.get(MIGRATION_TIMESTAMP_KEY, (err, value) => {
      if (err) {
        // Key doesn't exist or other error
        resolve(null);
      } else {
        const timestamp = parseInt(value as string, 10);
        resolve(isNaN(timestamp) ? null : timestamp);
      }
    });
  });
}

/**
 * Write the migration timestamp to LevelDB.
 */
async function setMigrationTimestamp(
  db: levelup.LevelUp,
  timestamp: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    db.put(MIGRATION_TIMESTAMP_KEY, timestamp.toString(), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get the newest modification time of .ldb files in the LevelDB directory.
 */
async function getLevelDBNewestMtime(levelDbPath: string): Promise<number> {
  try {
    const files = await fs.readdirAsync(levelDbPath);
    const ldbFiles = files.filter((f: string) => f.endsWith(".ldb"));

    if (ldbFiles.length === 0) {
      // No .ldb files, check CURRENT file as fallback
      try {
        const currentStat = await fs.statAsync(
          path.join(levelDbPath, "CURRENT"),
        );
        return currentStat.mtimeMs;
      } catch {
        return 0;
      }
    }

    let newestMtime = 0;
    for (const file of ldbFiles) {
      try {
        const stat = await fs.statAsync(path.join(levelDbPath, file));
        if (stat.mtimeMs > newestMtime) {
          newestMtime = stat.mtimeMs;
        }
      } catch {
        // Ignore files we can't stat
      }
    }
    return newestMtime;
  } catch {
    return 0;
  }
}

/**
 * Check if LevelDB exists at the given path.
 */
async function levelDBExists(levelDbPath: string): Promise<boolean> {
  try {
    const stat = await fs.statAsync(levelDbPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Migrate data from LevelDB to PGlite in batches.
 */
async function migrateData(
  levelDb: levelup.LevelUp,
  pglite: PGlitePersist,
  isReMigration: boolean,
): Promise<void> {
  log("info", "Starting migration from LevelDB to PGlite", { isReMigration });

  // Clear PGlite if re-migrating
  if (isReMigration) {
    log("info", "Clearing existing PGlite data for re-migration");
    await pglite.clearAll();
  }

  // Read all data from LevelDB
  const allData = await readAllFromLevelDB(levelDb);
  log("info", `Migrating ${allData.length} records from LevelDB to PGlite`);

  // Log some sample keys for debugging
  if (allData.length > 0) {
    const sampleKeys = allData.slice(0, 5).map((d) => d.key.join("###"));
    log("info", "Sample keys being migrated", { sampleKeys });
  }

  // Insert in batches
  for (let i = 0; i < allData.length; i += BATCH_SIZE) {
    const batch = allData.slice(i, i + BATCH_SIZE);
    await pglite.batchInsert(batch);

    if (i + BATCH_SIZE < allData.length) {
      log("debug", `Migrated ${i + BATCH_SIZE} / ${allData.length} records`);
    }
  }

  // Write migration timestamp to LevelDB
  const timestamp = Date.now();
  await setMigrationTimestamp(levelDb, timestamp);

  log("info", "Migration complete", { recordCount: allData.length, timestamp });
}

/**
 * Create a PGlite persistor with automatic migration from LevelDB if needed.
 *
 * @param basePath - The base path where state directories are located
 * @param repair - Whether to attempt repair on the database
 * @returns A PGlitePersist instance
 */
export async function createPGlitePersistorWithMigration(
  basePath: string,
  repair: boolean = false,
): Promise<PGlitePersist> {
  const levelDbPath = path.join(basePath, "state.v2");
  const pglitePath = path.join(basePath, "state.pglite");

  // Check if LevelDB exists
  const hasLevelDB = await levelDBExists(levelDbPath);

  if (!hasLevelDB) {
    // No LevelDB, just create PGlite directly
    log("info", "No existing LevelDB found, creating fresh PGlite database");
    return PGlitePersist.create(pglitePath);
  }

  // Open LevelDB to check migration status
  let levelDb: LevelDB;
  try {
    levelDb = await openLevelDB(levelDbPath);
  } catch (err) {
    log(
      "warn",
      "Failed to open LevelDB for migration check, creating fresh PGlite",
      err,
    );
    return PGlitePersist.create(pglitePath);
  }

  try {
    // Get migration timestamp and LevelDB mtime
    const [migrationTimestamp, levelDbMtime] = await Promise.all([
      getMigrationTimestamp(levelDb.db),
      getLevelDBNewestMtime(levelDbPath),
    ]);

    // Determine if migration is needed
    let needsMigration = false;
    let isReMigration = false;

    if (migrationTimestamp === null) {
      // No timestamp - first migration
      needsMigration = true;
      isReMigration = false;
      log("info", "No migration timestamp found, will perform first migration");
    } else if (levelDbMtime > migrationTimestamp + MIGRATION_TIME_BUFFER) {
      // LevelDB has been modified since last migration
      needsMigration = true;
      isReMigration = true;
      log("info", "LevelDB modified since last migration, will re-migrate", {
        levelDbMtime,
        migrationTimestamp,
        diff: levelDbMtime - migrationTimestamp,
      });
    } else {
      log("info", "PGlite is up to date, no migration needed");
    }

    // Create/open PGlite
    const pglite = await PGlitePersist.create(pglitePath);

    if (needsMigration) {
      try {
        await migrateData(levelDb.db, pglite, isReMigration);
      } catch (err) {
        log("error", "Migration failed", err);
        // Close PGlite and re-throw
        await pglite.close();
        throw err;
      }
    }

    // Verify PGlite has data
    const allKeys = await pglite.getAllKeys();
    log("info", "PGlite database status", {
      keyCount: allKeys.length,
      sampleKeys:
        allKeys.length > 0 ? allKeys.slice(0, 5).map((k) => k.join("###")) : [],
    });

    if (allKeys.length === 0 && hasLevelDB) {
      log(
        "warn",
        "PGlite is empty but LevelDB exists - forcing re-migration",
      );
      await migrateData(levelDb.db, pglite, true);

      const newKeys = await pglite.getAllKeys();
      log("info", "After forced re-migration", { keyCount: newKeys.length });
    }

    // Close LevelDB - we're done with it
    await levelDb.close();

    return pglite;
  } catch (err) {
    // Make sure we close LevelDB on error
    try {
      await levelDb.close();
    } catch {
      // Ignore close errors
    }
    throw err;
  }
}
