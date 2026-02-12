import type { DuckDBConnection } from "@duckdb/node-api";

import type { Serializable } from "../../shared/types/ipc";
import { log } from "../logging";
import type { ParsedQuery } from "./queryParser";

interface RegisteredQuery {
  name: string;
  sql: string;
  params: Array<{ name: string; duckdbType: string }>;
  referencedTables: string[];
}

/**
 * Central runtime registry for named SQL queries.
 *
 * Responsibilities:
 * - Executes setup and view queries at startup
 * - Registers select queries with their table dependencies
 * - Maintains reverse index: tableName -> Set<queryName>
 * - Executes named queries with parameter binding
 */
class QueryRegistry {
  private mConnection: DuckDBConnection;
  private mQueries: Map<string, RegisteredQuery> = new Map();
  private mTableToQueries: Map<string, Set<string>> = new Map();

  constructor(connection: DuckDBConnection) {
    this.mConnection = connection;
  }

  /**
   * Initialize the registry with parsed queries.
   * Executes setup and view queries, then registers select queries.
   */
  public async initialize(queries: ParsedQuery[]): Promise<void> {
    const setupQueries = queries.filter((q) => q.type === "setup");
    const viewQueries = queries.filter((q) => q.type === "view");
    const selectQueries = queries.filter((q) => q.type === "select");

    // Execute setup queries (pivot table creation)
    for (const q of setupQueries) {
      log("debug", "query-registry: running setup query", { name: q.name });
      await this.mConnection.run(q.sql);
    }

    // Execute view queries
    for (const q of viewQueries) {
      log("debug", "query-registry: running view query", { name: q.name });
      await this.mConnection.run(q.sql);
    }

    // Register select queries and build dependency index
    for (const q of selectQueries) {
      log("debug", "query-registry: registering select query", {
        name: q.name,
      });

      // Extract table references from the query SQL
      let referencedTables: string[];
      try {
        referencedTables = [...this.mConnection.getTableNames(q.sql, true)];
      } catch {
        // Fallback: if getTableNames fails, use empty list
        referencedTables = [];
        log("warn", "query-registry: could not extract table names", {
          name: q.name,
        });
      }

      const registered: RegisteredQuery = {
        name: q.name,
        sql: q.sql,
        params: q.params,
        referencedTables,
      };

      this.mQueries.set(q.name, registered);

      // Build reverse index
      for (const table of referencedTables) {
        let querySet = this.mTableToQueries.get(table);
        if (querySet === undefined) {
          querySet = new Set();
          this.mTableToQueries.set(table, querySet);
        }
        querySet.add(q.name);
      }
    }

    log("info", "query-registry: initialized", {
      queries: this.mQueries.size,
      trackedTables: this.mTableToQueries.size,
    });
  }

  /**
   * Execute a named query with optional parameters.
   * Returns serializable row objects.
   */
  public async executeQuery(
    name: string,
    params?: Record<string, unknown>,
  ): Promise<Record<string, Serializable>[]> {
    const query = this.mQueries.get(name);
    if (query === undefined) {
      throw new Error(`Unknown query: '${name}'`);
    }

    // Build parameter bindings using named parameters ($name syntax)
    let values: Record<string, unknown> | undefined;
    if (params !== undefined && query.params.length > 0) {
      values = {};
      for (const paramDef of query.params) {
        const paramKey = `$${paramDef.name}`;
        if (paramDef.name in params) {
          values[paramKey] = params[paramDef.name];
        }
      }
    }

    const reader = await this.mConnection.runAndReadAll(
      query.sql,
      values as any,
    );
    return reader.getRowObjectsJson() as Record<string, Serializable>[];
  }

  /**
   * Given a list of dirty table names, return the query names that reference them.
   */
  public getAffectedQueries(dirtyTables: string[]): string[] {
    const affected = new Set<string>();
    for (const table of dirtyTables) {
      const queries = this.mTableToQueries.get(table);
      if (queries !== undefined) {
        for (const q of queries) {
          affected.add(q);
        }
      }
    }
    return [...affected];
  }

  /**
   * Get all registered select query names.
   */
  public getQueryNames(): string[] {
    return [...this.mQueries.keys()];
  }

  /**
   * Check if any queries are registered.
   */
  public get hasQueries(): boolean {
    return this.mQueries.size > 0;
  }
}

export default QueryRegistry;
