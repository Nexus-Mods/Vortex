import type { DuckDBConnection, DuckDBValue } from "@duckdb/node-api";

const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;

export function quoteIdentifier(name: string): string {
  if (!VALID_IDENTIFIER.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }
  return `"${name}"`;
}

export class View<T extends Record<string, unknown>> {
  protected readonly _connection: DuckDBConnection;
  protected readonly _tableName: string;

  constructor(connection: DuckDBConnection, tableName: string) {
    if (!VALID_IDENTIFIER.test(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }
    this._connection = connection;
    this._tableName = tableName;
  }

  async all(): Promise<T[]> {
    const reader = await this._connection.runAndReadAll(`SELECT * FROM ${this._tableName}`);
    return reader.getRowObjectsJson() as T[];
  }

  async where(filter: Partial<T>): Promise<T[]> {
    const entries = Object.entries(filter);
    if (entries.length === 0) {
      return this.all();
    }

    const clauses = entries.map((_, i) => `${quoteIdentifier(entries[i][0])} = $${i + 1}`);
    const values = entries.map(([, v]) => v as DuckDBValue);
    const sql = `SELECT * FROM ${this._tableName} WHERE ${clauses.join(" AND ")}`;

    const reader = await this._connection.runAndReadAll(sql, values);
    return reader.getRowObjectsJson() as T[];
  }

  async findOne(filter: Partial<T>): Promise<T | null> {
    const entries = Object.entries(filter);
    const clauses = entries.map((_, i) => `${quoteIdentifier(entries[i][0])} = $${i + 1}`);
    const values = entries.map(([, v]) => v as DuckDBValue);

    let sql = `SELECT * FROM ${this._tableName}`;
    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(" AND ")}`;
    }
    sql += " LIMIT 1";

    const reader = await this._connection.runAndReadAll(sql, values);
    const rows = reader.getRowObjectsJson() as T[];
    return rows.length > 0 ? rows[0] : null;
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    const rows = await this.all();
    for (const row of rows) {
      yield row;
    }
  }
}
