import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";

import { log } from "../logging";

/**
 * Manages a single shared in-memory DuckDB instance with level_pivot loaded.
 * All LevelPersist instances attach their databases to this shared instance.
 */
class DuckDBSingleton {
  static #sInstance: DuckDBSingleton | undefined;

  #mDuckDB: DuckDBInstance | undefined;
  #mInitialized: boolean = false;
  #mInitPromise: Promise<void> | undefined;
  #mNextAliasId: number = 0;
  #mAttachedDatabases: Map<string, string> = new Map(); // alias -> path
  #mConnections: DuckDBConnection[] = [];

  private constructor() {}

  public static getInstance(): DuckDBSingleton {
    if (DuckDBSingleton.#sInstance === undefined) {
      DuckDBSingleton.#sInstance = new DuckDBSingleton();
    }
    return DuckDBSingleton.#sInstance;
  }

  /**
   * Initialize the shared DuckDB instance, loading level_pivot from the
   * pre-downloaded extension cache directory.
   * Safe to call multiple times -- only initializes once.
   *
   * @param extensionDir - Path to the duckdb-extensions folder produced by the
   *   download script (e.g. `<appBase>/duckdb-extensions`). DuckDB looks for
   *   extensions under `{extensionDir}/{version}/{platform}/`.
   */
  public initialize(extensionDir: string): Promise<void> {
    if (this.#mInitialized) {
      return Promise.resolve();
    }

    // Guard against concurrent callers — return the in-flight promise if one exists
    if (this.#mInitPromise !== undefined) {
      return this.#mInitPromise;
    }

    this.#mInitPromise = (async () => {
      log("debug", "duckdb-singleton: creating shared instance", {
        extensionDir,
      });
      this.#mDuckDB = await DuckDBInstance.create(":memory:", {
        allow_unsigned_extensions: "true",
        extension_directory: extensionDir,
      });

      const connection = await this.#mDuckDB.connect();
      try {
        log("debug", "duckdb-singleton: loading level_pivot");
        await connection.run("LOAD level_pivot");
      } finally {
        connection.closeSync();
      }

      this.#mInitialized = true;
      this.#mInitPromise = undefined;
      log("debug", "duckdb-singleton: initialized");
    })();

    return this.#mInitPromise;
  }

  /**
   * Attach a LevelDB database with a unique alias.
   * Returns a connection to the shared instance.
   */
  public async attachDatabase(persistPath: string, alias: string): Promise<DuckDBConnection> {
    if (!this.#mInitialized || this.#mDuckDB === undefined) {
      throw new Error("DuckDBSingleton not initialized");
    }

    if (this.#mAttachedDatabases.has(alias)) {
      throw new Error(`Database alias '${alias}' already attached`);
    }

    const connection = await this.#mDuckDB.connect();
    this.#mConnections.push(connection);

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

    this.#mAttachedDatabases.set(alias, persistPath);
    log("debug", "duckdb-singleton: database attached", { alias });

    return connection;
  }

  /**
   * Detach a previously attached database.
   */
  public async detachDatabase(alias: string): Promise<void> {
    if (!this.#mInitialized || this.#mDuckDB === undefined) {
      return;
    }

    if (!this.#mAttachedDatabases.has(alias)) {
      return;
    }

    const connection = await this.#mDuckDB.connect();
    try {
      await connection.run(`DETACH ${alias}`);
    } finally {
      connection.closeSync();
    }

    this.#mAttachedDatabases.delete(alias);
    log("debug", "duckdb-singleton: database detached", { alias });
  }

  /**
   * Create a new connection to the shared instance.
   * Useful for query execution separate from the persistence connection.
   */
  public async createConnection(): Promise<DuckDBConnection> {
    if (!this.#mInitialized || this.#mDuckDB === undefined) {
      throw new Error("DuckDBSingleton not initialized");
    }

    const connection = await this.#mDuckDB.connect();
    this.#mConnections.push(connection);
    return connection;
  }

  /**
   * Close all connections and the shared instance.
   */
  public close(): void {
    for (const conn of this.#mConnections) {
      try {
        conn.closeSync();
      } catch {
        // connection may already be closed
      }
    }
    this.#mConnections = [];

    if (this.#mDuckDB !== undefined) {
      try {
        this.#mDuckDB.closeSync();
      } catch {
        // instance may already be closed
      }
      this.#mDuckDB = undefined;
    }

    this.#mAttachedDatabases.clear();
    this.#mInitialized = false;
    this.#mInitPromise = undefined;
    this.#mNextAliasId = 0;
    DuckDBSingleton.#sInstance = undefined;
    log("debug", "duckdb-singleton: closed");
  }

  /**
   * Generate a unique, monotonically-increasing database alias.
   * Safe to call concurrently — each call returns a distinct alias.
   */
  public nextAlias(): string {
    const id = this.#mNextAliasId++;
    return id === 0 ? "db" : `db_${id}`;
  }

  public get isInitialized(): boolean {
    return this.#mInitialized;
  }

  public get attachedDatabases(): ReadonlyMap<string, string> {
    return this.#mAttachedDatabases;
  }
}

export default DuckDBSingleton;
