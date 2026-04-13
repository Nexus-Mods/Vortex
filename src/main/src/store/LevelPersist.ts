import type { IPersistor } from "@vortex/shared/state";

import type { DuckDBConnection } from "@duckdb/node-api";

import { unknownToError } from "@vortex/shared";
import { DataInvalid } from "@vortex/shared/errors";

import * as path from "node:path";

import { log } from "../logging";
import { getVortexPath } from "../getVortexPath";
import DuckDBSingleton from "./DuckDBSingleton";

const SEPARATOR: string = "###";

export class DatabaseLocked extends Error {
  constructor() {
    super("Database is locked");
    this.name = this.constructor.name;
  }
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
      const extensionDir = path.join(
        getVortexPath("base_unpacked"),
        "duckdb-extensions",
      );
      await singleton.initialize(extensionDir);

      const alias = singleton.nextAlias();
      const connection = await singleton.attachDatabase(persistPath, alias);
      return new LevelPersist(connection, alias);
    } catch (unknownErr) {
      const err = unknownToError(unknownErr);
      log("warn", "duckdb: openDB failed", {
        message: err.message,
        triesRemaining: tries,
        path: persistPath,
      });
      if (err instanceof DataInvalid) {
        throw err;
      }
      if (/corrupt/i.test(err.message)) {
        throw new DataInvalid(err.message);
      }
      if (tries === 0) {
        log("info", "failed to open db", err);
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
    const reader = await this.#mConnection.runAndReadAll(
      `SELECT key FROM ${this.#mAlias}.kv`,
    );
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

  public async getAllKVs(
    prefix?: string,
  ): Promise<Array<{ key: string[]; value: string }>> {
    let reader;
    if (prefix === undefined) {
      reader = await this.#mConnection.runAndReadAll(
        `SELECT key, value FROM ${this.#mAlias}.kv`,
      );
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
    const key = statePath.join(SEPARATOR);
    // level_pivot tables don't support UNIQUE indexes, so ON CONFLICT
    // upserts aren't possible.  UPDATE … RETURNING is also unreliable:
    // level_pivot's EmitRowCount unconditionally emits a single-row chunk
    // (the "rows affected" count), which DuckDB's RETURNING pipeline
    // surfaces as the query result — so RETURNING always reports 1 row
    // regardless of whether any row was matched.  Use SELECT to check
    // existence, then UPDATE or INSERT accordingly.
    const ownTransaction = !this.#mInTransaction;
    if (ownTransaction) {
      await this.beginTransaction();
    }
    try {
      const exists = await this.#mConnection.runAndReadAll(
        `SELECT 1 FROM ${this.#mAlias}.kv WHERE key = $1`,
        [key],
      );
      if (exists.getRows().length > 0) {
        await this.#mConnection.run(
          `UPDATE ${this.#mAlias}.kv SET value = $2 WHERE key = $1`,
          [key, newState],
        );
      } else {
        await this.#mConnection.run(
          `INSERT INTO ${this.#mAlias}.kv VALUES ($1, $2)`,
          [key, newState],
        );
      }
      if (ownTransaction) {
        await this.commitTransaction();
      }
    } catch (err) {
      if (ownTransaction) {
        await this.rollbackTransaction();
      }
      throw err;
    }
  }

  public async removeItem(statePath: string[]): Promise<void> {
    await this.#mConnection.run(
      `DELETE FROM ${this.#mAlias}.kv WHERE key = $1`,
      [statePath.join(SEPARATOR)],
    );
  }

  /**
   * Begin a transaction on this connection.
   */
  public async beginTransaction(): Promise<void> {
    await this.#mConnection.run("BEGIN TRANSACTION");
    this.#mInTransaction = true;
  }

  /**
   * Commit the current transaction.
   */
  public async commitTransaction(): Promise<void> {
    await this.#mConnection.run("COMMIT");
    this.#mInTransaction = false;
  }

  /**
   * Rollback the current transaction.
   */
  public async rollbackTransaction(): Promise<void> {
    await this.#mConnection.run("ROLLBACK");
    this.#mInTransaction = false;
  }

  /**
   * Get dirty tables from level_pivot (tables modified in the current transaction).
   * Returns array of {database, table, type} tuples.
   */
  public async getDirtyTables(): Promise<
    Array<{ database: string; table: string; type: string }>
  > {
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
