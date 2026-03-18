import type { DuckDBConnection } from "@duckdb/node-api";
import type LevelPersist from "./LevelPersist";
import type QueryInvalidator from "./QueryInvalidator";
import { Table } from "./Table";
import { View } from "./View";

export interface TransactionContext {
  createTable<T extends Record<string, unknown>>(sqlTableName: string): Table<T>;
  createView<T extends Record<string, unknown>>(sqlTableName: string): View<T>;
}

export class Database {
  readonly #levelPersist: LevelPersist;
  readonly #invalidator: QueryInvalidator | null;

  constructor(
    levelPersist: LevelPersist,
    invalidator: QueryInvalidator | null,
  ) {
    this.#levelPersist = levelPersist;
    this.#invalidator = invalidator;
  }

  get #connection(): DuckDBConnection {
    return this.#levelPersist.connection;
  }

  createTable<T extends Record<string, unknown>>(sqlTableName: string): Table<T> {
    return new Table<T>(this.#connection, sqlTableName);
  }

  createView<T extends Record<string, unknown>>(sqlTableName: string): View<T> {
    return new View<T>(this.#connection, sqlTableName);
  }

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const reader = await this.#connection.runAndReadAll(sql, params);
    return reader.getRowObjectsJson() as T[];
  }

  async transaction(fn: (tx: TransactionContext) => Promise<void>): Promise<void> {
    await this.#levelPersist.beginTransaction();
    try {
      const tx: TransactionContext = {
        createTable: <T extends Record<string, unknown>>(name: string) =>
          new Table<T>(this.#connection, name),
        createView: <T extends Record<string, unknown>>(name: string) =>
          new View<T>(this.#connection, name),
      };
      await fn(tx);

      const dirtyTables = await this.#levelPersist.getDirtyTables();
      await this.#levelPersist.commitTransaction();

      if (this.#invalidator && dirtyTables.length > 0) {
        this.#invalidator.notifyDirtyTables(dirtyTables);
      }
    } catch (err) {
      await this.#levelPersist.rollbackTransaction();
      throw err;
    }
  }

  async autoTransaction(fn: (conn: DuckDBConnection) => Promise<void>): Promise<void> {
    await this.#levelPersist.beginTransaction();
    try {
      await fn(this.#connection);
      const dirtyTables = await this.#levelPersist.getDirtyTables();
      await this.#levelPersist.commitTransaction();
      if (this.#invalidator && dirtyTables.length > 0) {
        this.#invalidator.notifyDirtyTables(dirtyTables);
      }
    } catch (err) {
      await this.#levelPersist.rollbackTransaction();
      throw err;
    }
  }
}
