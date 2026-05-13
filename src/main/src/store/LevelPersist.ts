import * as path from "node:path";

import type { DuckDBConnection } from "@duckdb/node-api";
import { unknownToError } from "@vortex/shared";
import { DataInvalid } from "@vortex/shared/errors";
import type { IPersistor } from "@vortex/shared/state";

import { getVortexPath } from "../getVortexPath";
import { log } from "../logging";
import DuckDBSingleton from "./DuckDBSingleton";

const SEPARATOR: string = "###";

// Threshold (in milliseconds) above which a successful write is logged as
// a warning. Picked to be silent under healthy operation while still
// surfacing meaningful stalls in field log captures.
const SLOW_WRITE_THRESHOLD_MS = 250;

// When VORTEX_TRACE_DB_WRITES=1 is set in the environment, every persistence
// write logs an enter/exit pair at debug level so the "last enter without an
// exit" marks the wedged call. Read per-call so tests (and live operators)
// can flip it via vi.stubEnv / a relaunch without rebuilding.
function traceWritesEnabled(): boolean {
  return process.env.VORTEX_TRACE_DB_WRITES === "1";
}

export class DatabaseLocked extends Error {
  constructor() {
    super("Database is locked");
    this.name = this.constructor.name;
  }
}

export class DatabaseOpenError extends Error {
  public readonly path: string;
  public readonly cause: string;
  constructor(persistPath: string, cause: string) {
    super(`Failed to open database at ${persistPath}: ${cause}`);
    this.name = this.constructor.name;
    this.path = persistPath;
    this.cause = cause;
  }
}

// Lock-contention text produced by leveldb's env layer when another process
// holds the LOCK file — matched across platforms.  Only these messages should
// trigger the "another instance is running" code path.
function isLockContention(message: string): boolean {
  return /being used by another process|already held|resource (temporarily )?unavailable|resource busy/i.test(
    message,
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class LevelPersist implements IPersistor {
  public static async create(
    persistPath: string,
    tries: number = 10,
    repair: boolean = false,
  ): Promise<LevelPersist> {
    if (repair) {
      // Repair is a LevelDB concept — not applicable to DuckDB/level_pivot
      log("warn", "duckdb: repair requested but not supported, ignoring", {
        path: persistPath,
      });
    }
    try {
      const singleton = DuckDBSingleton.getInstance();
      const extensionDir = path.join(getVortexPath("base_unpacked"), "duckdb-extensions");
      await singleton.initialize(extensionDir);

      const alias = singleton.nextAlias();
      const connection = await singleton.attachDatabase(persistPath, alias);
      return new LevelPersist(connection, alias);
    } catch (unknownErr) {
      const err = unknownToError(unknownErr);
      if (err instanceof DataInvalid) {
        throw err;
      }
      if (/corrupt/i.test(err.message)) {
        throw new DataInvalid(err.message);
      }
      if (!isLockContention(err.message)) {
        // Not a lock conflict — retrying won't help. Surface the real cause so
        // the startup handler can show the user an accurate diagnostic instead
        // of the misleading "another instance is running" dialog.
        log("warn", "duckdb: openDB failed", {
          message: err.message,
          path: persistPath,
        });
        throw new DatabaseOpenError(persistPath, err.message);
      }
      log("warn", "duckdb: openDB locked, retrying", {
        message: err.message,
        triesRemaining: tries,
        path: persistPath,
      });
      if (tries === 0) {
        throw new DatabaseLocked();
      }
      await delay(500);
      return LevelPersist.create(persistPath, tries - 1, false);
    }
  }

  #mConnection: DuckDBConnection;
  #mAlias: string;
  #mInTransaction: boolean = false;

  constructor(connection: DuckDBConnection, alias: string) {
    this.#mConnection = connection;
    this.#mAlias = alias;
  }

  public get alias(): string {
    return this.#mAlias;
  }

  public get connection(): DuckDBConnection {
    return this.#mConnection;
  }

  public get inTransaction(): boolean {
    return this.#mInTransaction;
  }

  // Times a write through the connection. Default behaviour: silent on
  // success, warns when the call exceeded SLOW_WRITE_THRESHOLD_MS. With
  // VORTEX_TRACE_DB_WRITES=1 set in the environment, also emits an enter
  // line before the await and an exit line after - so an indefinite hang
  // (where the exit line never appears in vortex.log) pinpoints the
  // wedged call.
  private async timedWrite<T>(method: string, count: number, op: () => Promise<T>): Promise<T> {
    const trace = traceWritesEnabled();
    const start = Date.now();
    if (trace) {
      log("debug", "level_pivot Write enter", {
        method,
        alias: this.#mAlias,
        count,
      });
    }
    try {
      return await op();
    } finally {
      const elapsedMs = Date.now() - start;
      if (trace) {
        log("debug", "level_pivot Write exit", {
          method,
          alias: this.#mAlias,
          count,
          elapsedMs,
        });
      } else if (elapsedMs > SLOW_WRITE_THRESHOLD_MS) {
        log("warn", "level_pivot slow Write", {
          method,
          alias: this.#mAlias,
          count,
          elapsedMs,
        });
      }
    }
  }

  public async close(): Promise<void> {
    await DuckDBSingleton.getInstance().detachDatabase(this.#mAlias);
  }

  public setResetCallback(_cb: () => PromiseLike<void>): void {
    // Not implemented for DuckDB backend — DuckDB handles durability internally
  }

  public async getItem(key: string[]): Promise<string> {
    const reader = await this.#mConnection.runAndReadAll(
      `SELECT value FROM ${this.#mAlias}.kv WHERE key = $1`,
      [key.join(SEPARATOR)],
    );
    const rows = reader.getRows();
    if (rows.length === 0) {
      const err = new Error(`Key not found: ${key.join(SEPARATOR)}`);
      err.name = "NotFoundError";
      throw err;
    }
    return rows[0][0] as string;
  }

  public async getAllKeys(): Promise<string[][]> {
    const reader = await this.#mConnection.runAndReadAll(`SELECT key FROM ${this.#mAlias}.kv`);
    const rows = reader.getRows();
    return rows.map((row) => (row[0] as string).split(SEPARATOR));
  }

  /**
   * Get all unique hive names that have persisted data.
   * Extracts the first path segment (hive) from each key entirely in SQL.
   */
  public async getPersistedHives(): Promise<string[]> {
    const reader = await this.#mConnection.runAndReadAll(
      `SELECT DISTINCT
         CASE WHEN INSTR(key, '${SEPARATOR}') > 0
           THEN SUBSTR(key, 1, INSTR(key, '${SEPARATOR}') - 1)
           ELSE key
         END AS hive
       FROM ${this.#mAlias}.kv`,
    );
    const rows = reader.getRows();
    return rows.map((row) => row[0] as string);
  }

  public async getAllKVs(prefix?: string): Promise<Array<{ key: string[]; value: string }>> {
    let reader;
    if (prefix === undefined) {
      reader = await this.#mConnection.runAndReadAll(`SELECT key, value FROM ${this.#mAlias}.kv`);
    } else {
      reader = await this.#mConnection.runAndReadAll(
        `SELECT key, value FROM ${this.#mAlias}.kv WHERE key > $1 AND key < $2`,
        [`${prefix}${SEPARATOR}`, `${prefix}${SEPARATOR}zzzzzzzzzzz`],
      );
    }
    const rows = reader.getRows();
    return rows.map((row) => ({
      key: (row[0] as string).split(SEPARATOR),
      value: row[1] as string,
    })) as Array<{ key: string[]; value: string }>;
  }

  public async setItem(statePath: string[], newState: string): Promise<void> {
    // No internal BEGIN/COMMIT here. The previous implementation issued
    // three statements (SELECT-then-UPDATE-or-INSERT) and self-wrapped in a
    // transaction to keep them atomic against concurrent writers to the
    // same key. The new shape is a single statement - raw-mode level_pivot
    // tables have no UNIQUE constraint and the Sink unconditionally calls
    // batch.put, so plain INSERT already overwrites an existing row, and
    // DuckDB's auto-commit makes a one-statement INSERT atomic on its own.
    // Pinned by the upsert tests in the level_pivot extension's
    // level_pivot.test. Callers that need to batch multiple setItem /
    // removeItem calls atomically wrap them in beginTransaction /
    // commitTransaction explicitly (see ReduxPersistorIPC.processOperations
    // and Application.importBackup).
    await this.timedWrite("setItem", 1, () =>
      this.#mConnection.run(`INSERT INTO ${this.#mAlias}.kv VALUES ($1, $2)`, [
        statePath.join(SEPARATOR),
        newState,
      ]),
    );
  }

  // Removes the exact key and any descendants (keys whose stored form is
  // `<key>###...`). Subtree removal is needed because some persistence paths
  // store an object as a single JSON blob at an intermediate path, while
  // others decompose it into one row per leaf - a parent-only delete would
  // leave the blob row orphaned (the "infinite repair loop" failure mode).
  // starts_with is a literal prefix match, so segments containing LIKE
  // metacharacters (`_`, `%`) - common in keys like `skyrim_se` - cannot
  // over-match. SEPARATOR collisions are structurally impossible: keys
  // cannot contain `###` except as a separator.
  public async removeItem(statePath: string[]): Promise<void> {
    const key = statePath.join(SEPARATOR);
    await this.timedWrite("removeItem", 1, () =>
      this.#mConnection.run(
        `DELETE FROM ${this.#mAlias}.kv WHERE key = $1 OR starts_with(key, $2)`,
        [key, `${key}${SEPARATOR}`],
      ),
    );
  }

  /**
   * Bulk variant of setItem: a single multi-row INSERT covering every item.
   * Relies on the same upsert behaviour as setItem. The caller is expected
   * to chunk large diffs to bound failure granularity (see
   * ReduxPersistorIPC.processOperations).
   */
  public async bulkSetItem(items: ReadonlyArray<{ key: string[]; value: string }>): Promise<void> {
    if (items.length === 0) {
      return;
    }
    // Build "VALUES ($1, $2), ($3, $4), ..." with positional params.
    const placeholders: string[] = [];
    const params: string[] = [];
    for (let i = 0; i < items.length; i++) {
      placeholders.push(`($${2 * i + 1}, $${2 * i + 2})`);
      params.push(items[i].key.join(SEPARATOR), items[i].value);
    }
    await this.timedWrite("bulkSetItem", items.length, () =>
      this.#mConnection.run(
        `INSERT INTO ${this.#mAlias}.kv VALUES ${placeholders.join(", ")}`,
        params,
      ),
    );
  }

  /**
   * Bulk variant of removeItem: a single DELETE statement covering every
   * key. Each input key removes the exact match and any descendants - same
   * subtree semantics as removeItem (see comment there). The caller is
   * expected to chunk large lists; with BULK_CHUNK_SIZE=256 the parameter
   * count stays at 2*256=512.
   */
  public async bulkRemoveItem(keys: ReadonlyArray<string[]>): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    const clauses: string[] = [];
    const params: string[] = [];
    for (let i = 0; i < keys.length; i++) {
      const exact = 2 * i + 1;
      const prefix = 2 * i + 2;
      clauses.push(`key = $${exact} OR starts_with(key, $${prefix})`);
      const key = keys[i].join(SEPARATOR);
      params.push(key, `${key}${SEPARATOR}`);
    }
    await this.timedWrite("bulkRemoveItem", keys.length, () =>
      this.#mConnection.run(`DELETE FROM ${this.#mAlias}.kv WHERE ${clauses.join(" OR ")}`, params),
    );
  }

  /**
   * Begin a transaction on this connection. The in-transaction flag is only
   * set if BEGIN succeeds.
   */
  public async beginTransaction(): Promise<void> {
    await this.#mConnection.run("BEGIN TRANSACTION");
    this.#mInTransaction = true;
  }

  /**
   * Commit the current transaction.
   */
  public async commitTransaction(): Promise<void> {
    try {
      await this.#mConnection.run("COMMIT");
    } finally {
      this.#mInTransaction = false;
    }
  }

  /**
   * Rollback the current transaction.
   */
  public async rollbackTransaction(): Promise<void> {
    try {
      await this.#mConnection.run("ROLLBACK");
    } finally {
      this.#mInTransaction = false;
    }
  }

  /**
   * Get dirty tables from level_pivot (tables modified in the current transaction).
   * Returns array of {database, table, type} tuples.
   */
  public async getDirtyTables(): Promise<Array<{ database: string; table: string; type: string }>> {
    const reader = await this.#mConnection.runAndReadAll(
      "SELECT * FROM level_pivot_dirty_tables()",
    );
    const rows = reader.getRows();
    return rows.map((row) => ({
      database: row[0] as string,
      table: row[1] as string,
      type: row[2] as string,
    }));
  }
}

export default LevelPersist;
