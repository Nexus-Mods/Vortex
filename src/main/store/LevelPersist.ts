import type { DuckDBConnection } from "@duckdb/node-api";

import type { IPersistor } from "../../shared/types/state";

import { unknownToError } from "../../shared/errors";
import { DataInvalid } from "../../shared/types/errors";
import { log } from "../logging";
import DuckDBSingleton from "./DuckDBSingleton";

const SEPARATOR: string = "###";

export class DatabaseLocked extends Error {
  constructor() {
    super("Database is locked");
    this.name = this.constructor.name;
  }
}

function repairDB(dbPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    log("warn", "repairing database", dbPath);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const leveldown = require("leveldown") as {
      repair: (path: string, cb: (err: Error) => void) => void;
    };
    leveldown.repair(dbPath, (err: Error) => {
      if (err !== null) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
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
    try {
      if (repair) {
        await repairDB(persistPath);
      }

      const singleton = DuckDBSingleton.getInstance();
      await singleton.initialize();

      // Generate a unique alias for this database
      const alias =
        singleton.attachedDatabases.size === 0
          ? "db"
          : `db_${singleton.attachedDatabases.size}`;

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

  private mConnection: DuckDBConnection;
  private mAlias: string;

  constructor(connection: DuckDBConnection, alias: string) {
    this.mConnection = connection;
    this.mAlias = alias;
  }

  public get alias(): string {
    return this.mAlias;
  }

  public get connection(): DuckDBConnection {
    return this.mConnection;
  }

  public close = this.restackingFunc(async (): Promise<void> => {
    await DuckDBSingleton.getInstance().detachDatabase(this.mAlias);
  });

  public setResetCallback(cb: () => PromiseLike<void>): void {
    return undefined;
  }

  public getItem = this.restackingFunc(
    async (key: string[]): Promise<string> => {
      const reader = await this.mConnection.runAndReadAll(
        `SELECT value FROM ${this.mAlias}.kv WHERE key = $1`,
        [key.join(SEPARATOR)],
      );
      const rows = reader.getRows();
      if (rows.length === 0) {
        const err = new Error(`Key not found: ${key.join(SEPARATOR)}`);
        err.name = "NotFoundError";
        throw err;
      }
      return rows[0][0] as string;
    },
  );

  public async getAllKeys(): Promise<string[][]> {
    const reader = await this.mConnection.runAndReadAll(
      `SELECT key FROM ${this.mAlias}.kv`,
    );
    const rows = reader.getRows();
    return rows.map((row) => (row[0] as string).split(SEPARATOR));
  }

  /**
   * Get all unique hive names that have persisted data.
   * Extracts the first segment of each key to find all hives.
   */
  public async getPersistedHives(): Promise<string[]> {
    const reader = await this.mConnection.runAndReadAll(
      `SELECT DISTINCT key FROM ${this.mAlias}.kv`,
    );
    const rows = reader.getRows();
    const hives = new Set<string>();
    for (const row of rows) {
      const key = row[0] as string;
      const separatorIndex = key.indexOf(SEPARATOR);
      const hive = separatorIndex >= 0 ? key.slice(0, separatorIndex) : key;
      hives.add(hive);
    }
    return [...hives];
  }

  public async getAllKVs(
    prefix?: string,
  ): Promise<Array<{ key: string[]; value: string }>> {
    let reader;
    if (prefix === undefined) {
      reader = await this.mConnection.runAndReadAll(
        `SELECT key, value FROM ${this.mAlias}.kv`,
      );
    } else {
      reader = await this.mConnection.runAndReadAll(
        `SELECT key, value FROM ${this.mAlias}.kv WHERE key > $1 AND key < $2`,
        [`${prefix}${SEPARATOR}`, `${prefix}${SEPARATOR}zzzzzzzzzzz`],
      );
    }
    const rows = reader.getRows();
    return rows.map((row) => ({
      key: (row[0] as string).split(SEPARATOR),
      value: row[1] as string,
    }));
  }

  public setItem = this.restackingFunc(
    async (statePath: string[], newState: string): Promise<void> => {
      await this.mConnection.run(
        `INSERT INTO ${this.mAlias}.kv VALUES ($1, $2)`,
        [statePath.join(SEPARATOR), newState],
      );
    },
  );

  public removeItem = this.restackingFunc(
    async (statePath: string[]): Promise<void> => {
      await this.mConnection.run(
        `DELETE FROM ${this.mAlias}.kv WHERE key = $1`,
        [statePath.join(SEPARATOR)],
      );
    },
  );

  /**
   * Begin a transaction on this connection.
   */
  public async beginTransaction(): Promise<void> {
    await this.mConnection.run("BEGIN TRANSACTION");
  }

  /**
   * Commit the current transaction.
   */
  public async commitTransaction(): Promise<void> {
    await this.mConnection.run("COMMIT");
  }

  /**
   * Rollback the current transaction.
   */
  public async rollbackTransaction(): Promise<void> {
    await this.mConnection.run("ROLLBACK");
  }

  /**
   * Get dirty tables from level_pivot (tables modified in the current transaction).
   * Returns array of {database, table, type} tuples.
   */
  public async getDirtyTables(): Promise<
    Array<{ database: string; table: string; type: string }>
  > {
    const reader = await this.mConnection.runAndReadAll(
      "SELECT * FROM level_pivot_dirty_tables()",
    );
    const rows = reader.getRows();
    return rows.map((row) => ({
      database: row[0] as string,
      table: row[1] as string,
      type: row[2] as string,
    }));
  }

  private restackingFunc<T extends (...args: any[]) => Promise<any>>(
    cb: T,
  ): (...args: Parameters<T>) => ReturnType<T> {
    return ((...args: Parameters<T>): ReturnType<T> => {
      const stackErr = new Error();
      return cb(...args).catch((unknownErr: unknown) => {
        const err = unknownToError(unknownErr);
        err.stack = stackErr.stack;
        throw err;
      }) as ReturnType<T>;
    }) as (...args: Parameters<T>) => ReturnType<T>;
  }
}

export default LevelPersist;
