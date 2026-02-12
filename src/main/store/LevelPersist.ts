import type leveldownT from "leveldown";

import type { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";

import type { IPersistor } from "../../shared/types/state";

import { unknownToError } from "../../shared/errors";
import { DataInvalid } from "../../shared/types/errors";
import { log } from "../logging";

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
    const leveldown: typeof leveldownT = require("leveldown");
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

async function openDB(persistPath: string): Promise<{
  instance: DuckDBInstance;
  connection: DuckDBConnection;
}> {
  const { DuckDBInstance: DuckDBInstanceCtor } = require("@duckdb/node-api");
  log("debug", "duckdb: creating instance");
  const instance: DuckDBInstance = await DuckDBInstanceCtor.create(":memory:", {
    allow_unsigned_extensions: "true",
  });
  const connection: DuckDBConnection = await instance.connect();
  log("debug", "duckdb: installing level_pivot");
  await connection.run(
    "INSTALL level_pivot FROM 'https://halgari.github.io/duckdb-level-pivot/current_release'",
  );
  log("debug", "duckdb: loading level_pivot");
  await connection.run("LOAD level_pivot");

  const escapedPath = persistPath.replace(/'/g, "''");
  log("debug", "duckdb: attaching database", persistPath);
  await connection.run(
    `ATTACH '${escapedPath}' AS db (TYPE level_pivot, CREATE_IF_MISSING true)`,
  );
  log("debug", "duckdb: creating kv table");
  await connection.run(
    "CALL level_pivot_create_table('db', 'kv', NULL, ['key', 'value'], table_mode := 'raw')",
  );

  log("debug", "duckdb: database opened successfully");
  return { instance, connection };
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
      const { instance, connection } = await openDB(persistPath);
      return new LevelPersist(instance, connection);
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

  private mInstance: DuckDBInstance;
  private mConnection: DuckDBConnection;

  constructor(instance: DuckDBInstance, connection: DuckDBConnection) {
    this.mInstance = instance;
    this.mConnection = connection;
  }

  public close = this.restackingFunc(async (): Promise<void> => {
    this.mConnection.closeSync();
    this.mInstance.closeSync();
  });

  public setResetCallback(cb: () => PromiseLike<void>): void {
    return undefined;
  }

  public getItem = this.restackingFunc(
    async (key: string[]): Promise<string> => {
      const reader = await this.mConnection.runAndReadAll(
        "SELECT value FROM db.kv WHERE key = $1",
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
      "SELECT key FROM db.kv",
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
      "SELECT DISTINCT key FROM db.kv",
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
        "SELECT key, value FROM db.kv",
      );
    } else {
      reader = await this.mConnection.runAndReadAll(
        "SELECT key, value FROM db.kv WHERE key > $1 AND key < $2",
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
      await this.mConnection.run("INSERT INTO db.kv VALUES ($1, $2)", [
        statePath.join(SEPARATOR),
        newState,
      ]);
    },
  );

  public removeItem = this.restackingFunc(
    async (statePath: string[]): Promise<void> => {
      await this.mConnection.run("DELETE FROM db.kv WHERE key = $1", [
        statePath.join(SEPARATOR),
      ]);
    },
  );

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
