import type { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";

import { log } from "../logging";

/**
 * Manages a single shared in-memory DuckDB instance with level_pivot loaded.
 * All LevelPersist instances attach their databases to this shared instance.
 */
class DuckDBSingleton {
  private static sInstance: DuckDBSingleton | undefined;

  private mDuckDB: DuckDBInstance | undefined;
  private mInitialized: boolean = false;
  private mAttachedDatabases: Map<string, string> = new Map(); // alias -> path
  private mConnections: DuckDBConnection[] = [];

  private constructor() {}

  public static getInstance(): DuckDBSingleton {
    if (DuckDBSingleton.sInstance === undefined) {
      DuckDBSingleton.sInstance = new DuckDBSingleton();
    }
    return DuckDBSingleton.sInstance;
  }

  /**
   * Initialize the shared DuckDB instance, installing and loading level_pivot.
   * Safe to call multiple times — only initializes once.
   */
  public async initialize(): Promise<void> {
    if (this.mInitialized) {
      return;
    }

    const { DuckDBInstance: DuckDBInstanceCtor } = require("@duckdb/node-api");
    log("debug", "duckdb-singleton: creating shared instance");
    this.mDuckDB = await DuckDBInstanceCtor.create(":memory:", {
      allow_unsigned_extensions: "true",
    });

    const connection = await this.mDuckDB.connect();
    try {
      log("debug", "duckdb-singleton: installing level_pivot");
      await connection.run(
        "INSTALL level_pivot FROM 'https://halgari.github.io/duckdb-level-pivot/current_release'",
      );
      log("debug", "duckdb-singleton: loading level_pivot");
      await connection.run("LOAD level_pivot");
    } finally {
      connection.closeSync();
    }

    this.mInitialized = true;
    log("debug", "duckdb-singleton: initialized");
  }

  /**
   * Attach a LevelDB database with a unique alias.
   * Returns a connection to the shared instance.
   */
  public async attachDatabase(
    persistPath: string,
    alias: string,
  ): Promise<DuckDBConnection> {
    if (!this.mInitialized || this.mDuckDB === undefined) {
      throw new Error("DuckDBSingleton not initialized");
    }

    if (this.mAttachedDatabases.has(alias)) {
      throw new Error(`Database alias '${alias}' already attached`);
    }

    const connection = await this.mDuckDB.connect();
    this.mConnections.push(connection);

    const escapedPath = persistPath.replace(/'/g, "''");
    log("debug", "duckdb-singleton: attaching database", {
      path: persistPath,
      alias,
    });
    await connection.run(
      `ATTACH '${escapedPath}' AS ${alias} (TYPE level_pivot, CREATE_IF_MISSING true)`,
    );
    await connection.run(
      `CALL level_pivot_create_table('${alias}', 'kv', NULL, ['key', 'value'], table_mode := 'raw')`,
    );

    this.mAttachedDatabases.set(alias, persistPath);
    log("debug", "duckdb-singleton: database attached", { alias });

    return connection;
  }

  /**
   * Detach a previously attached database.
   */
  public async detachDatabase(alias: string): Promise<void> {
    if (!this.mInitialized || this.mDuckDB === undefined) {
      return;
    }

    if (!this.mAttachedDatabases.has(alias)) {
      return;
    }

    const connection = await this.mDuckDB.connect();
    try {
      await connection.run(`DETACH ${alias}`);
    } finally {
      connection.closeSync();
    }

    this.mAttachedDatabases.delete(alias);
    log("debug", "duckdb-singleton: database detached", { alias });
  }

  /**
   * Create a new connection to the shared instance.
   * Useful for query execution separate from the persistence connection.
   */
  public async createConnection(): Promise<DuckDBConnection> {
    if (!this.mInitialized || this.mDuckDB === undefined) {
      throw new Error("DuckDBSingleton not initialized");
    }

    const connection = await this.mDuckDB.connect();
    this.mConnections.push(connection);
    return connection;
  }

  /**
   * Close all connections and the shared instance.
   */
  public close(): void {
    for (const conn of this.mConnections) {
      try {
        conn.closeSync();
      } catch {
        // connection may already be closed
      }
    }
    this.mConnections = [];

    if (this.mDuckDB !== undefined) {
      try {
        this.mDuckDB.closeSync();
      } catch {
        // instance may already be closed
      }
      this.mDuckDB = undefined;
    }

    this.mAttachedDatabases.clear();
    this.mInitialized = false;
    DuckDBSingleton.sInstance = undefined;
    log("debug", "duckdb-singleton: closed");
  }

  public get isInitialized(): boolean {
    return this.mInitialized;
  }

  public get attachedDatabases(): ReadonlyMap<string, string> {
    return this.mAttachedDatabases;
  }
}

export default DuckDBSingleton;
