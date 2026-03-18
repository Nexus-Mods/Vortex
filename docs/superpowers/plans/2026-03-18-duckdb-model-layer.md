# DuckDB Model Layer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add typed `Table<T>` and `View<T>` wrappers over DuckDB level_pivot pivot tables, with a `Database` class providing transaction-scoped access and query invalidation.

**Architecture:** A generic `View<T>` provides read-only typed access (all, where, findOne, iteration). `Table<T>` extends it with insert/update/delete. A `Database` class manages a shared DuckDB connection, provides `models` (generated), `transaction()` for scoped writes, and `query<T>()` for raw SQL. Build-time code generation is extended to produce row types for pivot tables and a `Models` interface + factory.

**Tech Stack:** DuckDB (`@duckdb/node-api`), level_pivot extension, TypeScript, Jest

**Spec:** `docs/superpowers/specs/2026-03-18-duckdb-model-layer-design.md`

---

## File Structure

### New Files
| File | Purpose |
|------|---------|
| `src/main/store/View.ts` | Generic read-only typed table wrapper |
| `src/main/store/Table.ts` | Generic read/write typed table wrapper (extends View) |
| `src/main/store/Database.ts` | Connection + transaction manager + models holder |
| `__tests__/store/View.test.ts` | View unit tests |
| `__tests__/store/Table.test.ts` | Table unit tests |
| `__tests__/store/Database.test.ts` | Database + transaction tests |
| `__tests__/store/queryParser.test.ts` | Query parser alias tests |

### Modified Files
| File | Change |
|------|--------|
| `src/main/store/queryParser.ts` | Add `-- @alias` annotation parsing |
| `scripts/generate-query-types.ts` | Add pivot table introspection, Models interface generation, Row suffix, alias support |
| `src/shared/types/generated/queryTypes.ts` | Regenerated with new types |
| `src/main/store/mainPersistence.ts` | Create and expose `Database` instance |

---

## Chunk 1: View\<T\> and Table\<T\> Core

### Task 1: View\<T\> — read-only typed table wrapper

**Files:**
- Create: `src/main/store/View.ts`
- Create: `__tests__/store/View.test.ts`

- [ ] **Step 1: Write View test file with tests for all(), where(), findOne()**

```typescript
// __tests__/store/View.test.ts
import { View } from "../../src/main/store/View";

// We mock the DuckDB connection to avoid needing a real database in unit tests.
// Each test verifies SQL generation and result mapping.

interface TestRow {
  id: string;
  name: string;
  value: number;
}

function createMockConnection(rows: TestRow[] = []) {
  const runAndReadAll = jest.fn().mockResolvedValue({
    getRowObjectsJson: () => rows,
  });
  return { runAndReadAll } as any;
}

describe("View", () => {
  describe("all()", () => {
    it("returns all rows from the table", async () => {
      const rows = [
        { id: "1", name: "a", value: 10 },
        { id: "2", name: "b", value: 20 },
      ];
      const conn = createMockConnection(rows);
      const view = new View<TestRow>(conn, "test_table");

      const result = await view.all();

      expect(result).toEqual(rows);
      expect(conn.runAndReadAll).toHaveBeenCalledWith(
        "SELECT * FROM test_table"
      );
    });

    it("returns empty array for empty table", async () => {
      const conn = createMockConnection([]);
      const view = new View<TestRow>(conn, "test_table");

      const result = await view.all();

      expect(result).toEqual([]);
    });
  });

  describe("where()", () => {
    it("filters by a single column", async () => {
      const rows = [{ id: "1", name: "a", value: 10 }];
      const conn = createMockConnection(rows);
      const view = new View<TestRow>(conn, "test_table");

      const result = await view.where({ name: "a" });

      expect(result).toEqual(rows);
      expect(conn.runAndReadAll).toHaveBeenCalledWith(
        "SELECT * FROM test_table WHERE name = $1",
        ["a"]
      );
    });

    it("filters by multiple columns with AND", async () => {
      const conn = createMockConnection([]);
      const view = new View<TestRow>(conn, "test_table");

      await view.where({ name: "a", value: 10 });

      expect(conn.runAndReadAll).toHaveBeenCalledWith(
        "SELECT * FROM test_table WHERE name = $1 AND value = $2",
        ["a", 10]
      );
    });

    it("returns all rows when no filter keys provided", async () => {
      const conn = createMockConnection([
        { id: "1", name: "a", value: 10 },
      ]);
      const view = new View<TestRow>(conn, "test_table");

      await view.where({});

      expect(conn.runAndReadAll).toHaveBeenCalledWith(
        "SELECT * FROM test_table"
      );
    });
  });

  describe("findOne()", () => {
    it("returns first matching row", async () => {
      const row = { id: "1", name: "a", value: 10 };
      const conn = createMockConnection([row]);
      const view = new View<TestRow>(conn, "test_table");

      const result = await view.findOne({ id: "1" });

      expect(result).toEqual(row);
      expect(conn.runAndReadAll).toHaveBeenCalledWith(
        "SELECT * FROM test_table WHERE id = $1 LIMIT 1",
        ["1"]
      );
    });

    it("returns null when no match", async () => {
      const conn = createMockConnection([]);
      const view = new View<TestRow>(conn, "test_table");

      const result = await view.findOne({ id: "missing" });

      expect(result).toBeNull();
    });
  });

  describe("iteration", () => {
    it("supports for...of via Symbol.asyncIterator", async () => {
      const rows = [
        { id: "1", name: "a", value: 10 },
        { id: "2", name: "b", value: 20 },
      ];
      const conn = createMockConnection(rows);
      const view = new View<TestRow>(conn, "test_table");

      const collected: TestRow[] = [];
      for await (const row of view) {
        collected.push(row);
      }

      expect(collected).toEqual(rows);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test __tests__/store/View.test.ts`
Expected: FAIL — `Cannot find module '../../src/main/store/View'`

- [ ] **Step 3: Implement View\<T\>**

View uses `protected` fields so Table can inherit without duplicating them.

```typescript
// src/main/store/View.ts
import type { DuckDBConnection } from "@duckdb/node-api";

export class View<T extends Record<string, unknown>> {
  protected readonly _connection: DuckDBConnection;
  protected readonly _tableName: string;

  constructor(connection: DuckDBConnection, tableName: string) {
    this._connection = connection;
    this._tableName = tableName;
  }

  async all(): Promise<T[]> {
    const reader = await this._connection.runAndReadAll(
      `SELECT * FROM ${this._tableName}`
    );
    return reader.getRowObjectsJson() as T[];
  }

  async where(filter: Partial<T>): Promise<T[]> {
    const entries = Object.entries(filter);
    if (entries.length === 0) {
      return this.all();
    }

    const clauses = entries.map(
      (_, i) => `${entries[i][0]} = $${i + 1}`
    );
    const values = entries.map(([, v]) => v);
    const sql = `SELECT * FROM ${this._tableName} WHERE ${clauses.join(" AND ")}`;

    const reader = await this._connection.runAndReadAll(sql, values);
    return reader.getRowObjectsJson() as T[];
  }

  async findOne(filter: Partial<T>): Promise<T | null> {
    const entries = Object.entries(filter);
    const clauses = entries.map(
      (_, i) => `${entries[i][0]} = $${i + 1}`
    );
    const values = entries.map(([, v]) => v);

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test __tests__/store/View.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/store/View.ts __tests__/store/View.test.ts
git commit -m "feat: add View<T> read-only typed table wrapper"
```

---

### Task 2: Table\<T\> — read/write typed table wrapper

**Files:**
- Create: `src/main/store/Table.ts`
- Create: `__tests__/store/Table.test.ts`

- [ ] **Step 1: Write Table test file**

```typescript
// __tests__/store/Table.test.ts
import { Table } from "../../src/main/store/Table";

interface TestRow {
  id: string;
  name: string;
  value: number;
}

function createMockConnection(rows: TestRow[] = []) {
  return {
    runAndReadAll: jest.fn().mockResolvedValue({
      getRowObjectsJson: () => rows,
    }),
    run: jest.fn().mockResolvedValue(undefined),
  } as any;
}

describe("Table", () => {
  describe("inherits View", () => {
    it("has all(), where(), findOne()", async () => {
      const rows = [{ id: "1", name: "a", value: 10 }];
      const conn = createMockConnection(rows);
      const table = new Table<TestRow>(conn, "test_table");

      expect(await table.all()).toEqual(rows);
      expect(await table.where({ id: "1" })).toEqual(rows);
      expect(await table.findOne({ id: "1" })).toEqual(rows[0]);
    });
  });

  describe("insert()", () => {
    it("inserts a single row", async () => {
      const conn = createMockConnection();
      const table = new Table<TestRow>(conn, "test_table");

      await table.insert({ id: "1", name: "a", value: 10 });

      expect(conn.run).toHaveBeenCalledWith(
        "INSERT INTO test_table (id, name, value) VALUES ($1, $2, $3)",
        ["1", "a", 10]
      );
    });
  });

  describe("insertMany()", () => {
    it("inserts multiple rows", async () => {
      const conn = createMockConnection();
      const table = new Table<TestRow>(conn, "test_table");

      await table.insertMany([
        { id: "1", name: "a", value: 10 },
        { id: "2", name: "b", value: 20 },
      ]);

      expect(conn.run).toHaveBeenCalledTimes(2);
    });
  });

  describe("update()", () => {
    it("updates matching rows", async () => {
      const conn = createMockConnection();
      const table = new Table<TestRow>(conn, "test_table");

      await table.update({ id: "1" }, { name: "updated" });

      expect(conn.run).toHaveBeenCalledWith(
        "UPDATE test_table SET name = $1 WHERE id = $2",
        ["updated", "1"]
      );
    });

    it("is a no-op when set is empty", async () => {
      const conn = createMockConnection();
      const table = new Table<TestRow>(conn, "test_table");

      await table.update({ id: "1" }, {});

      expect(conn.run).not.toHaveBeenCalled();
    });
  });

  describe("delete()", () => {
    it("deletes matching rows", async () => {
      const conn = createMockConnection();
      const table = new Table<TestRow>(conn, "test_table");

      await table.delete({ id: "1" });

      expect(conn.run).toHaveBeenCalledWith(
        "DELETE FROM test_table WHERE id = $1",
        ["1"]
      );
    });

    it("throws on empty filter to prevent full-table delete", async () => {
      const conn = createMockConnection();
      const table = new Table<TestRow>(conn, "test_table");

      await expect(table.delete({})).rejects.toThrow(
        "delete() requires at least one filter"
      );
      expect(conn.run).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test __tests__/store/Table.test.ts`
Expected: FAIL — `Cannot find module '../../src/main/store/Table'`

- [ ] **Step 3: Implement Table\<T\>**

Table inherits from View and uses the protected `_connection` and `_tableName` fields — no duplication.

```typescript
// src/main/store/Table.ts
import { View } from "./View";

export class Table<T extends Record<string, unknown>> extends View<T> {
  async insert(row: T): Promise<void> {
    const keys = Object.keys(row);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const values = Object.values(row);
    const sql = `INSERT INTO ${this._tableName} (${keys.join(", ")}) VALUES (${placeholders.join(", ")})`;
    await this._connection.run(sql, values);
  }

  async insertMany(rows: T[]): Promise<void> {
    for (const row of rows) {
      await this.insert(row);
    }
  }

  async update(where: Partial<T>, set: Partial<T>): Promise<void> {
    const setEntries = Object.entries(set);
    if (setEntries.length === 0) {
      return; // no-op
    }

    const whereEntries = Object.entries(where);
    let paramIndex = 1;

    const setClauses = setEntries.map(
      ([key]) => `${key} = $${paramIndex++}`
    );
    const whereClauses = whereEntries.map(
      ([key]) => `${key} = $${paramIndex++}`
    );
    const values = [
      ...setEntries.map(([, v]) => v),
      ...whereEntries.map(([, v]) => v),
    ];

    let sql = `UPDATE ${this._tableName} SET ${setClauses.join(", ")}`;
    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(" AND ")}`;
    }
    await this._connection.run(sql, values);
  }

  async delete(where: Partial<T>): Promise<void> {
    const entries = Object.entries(where);
    if (entries.length === 0) {
      throw new Error("delete() requires at least one filter");
    }

    const clauses = entries.map(
      (_, i) => `${entries[i][0]} = $${i + 1}`
    );
    const values = entries.map(([, v]) => v);
    const sql = `DELETE FROM ${this._tableName} WHERE ${clauses.join(" AND ")}`;
    await this._connection.run(sql, values);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test __tests__/store/Table.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/store/Table.ts __tests__/store/Table.test.ts
git commit -m "feat: add Table<T> read/write typed table wrapper"
```

---

### Task 3: Database class — connection, transactions, models

**Files:**
- Create: `src/main/store/Database.ts`
- Create: `__tests__/store/Database.test.ts`

The Database class uses `createTable`/`createView` factory methods (which the generated `createModels()` will also call). Models are cached after first creation. Writes outside explicit transactions auto-wrap in BEGIN/getDirtyTables/COMMIT per the spec.

- [ ] **Step 1: Write Database test file**

```typescript
// __tests__/store/Database.test.ts
import { Database } from "../../src/main/store/Database";
import { View } from "../../src/main/store/View";
import { Table } from "../../src/main/store/Table";

interface ModRow {
  mod_id: string;
  name: string;
}

function createMockConnection() {
  return {
    run: jest.fn().mockResolvedValue(undefined),
    runAndReadAll: jest.fn().mockResolvedValue({
      getRowObjectsJson: () => [],
    }),
  } as any;
}

function createMockLevelPersist() {
  return {
    connection: createMockConnection(),
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    getDirtyTables: jest.fn().mockResolvedValue([]),
  } as any;
}

function createMockInvalidator() {
  return {
    notifyDirtyTables: jest.fn(),
  } as any;
}

describe("Database", () => {
  describe("createTable / createView", () => {
    it("creates Table instances", () => {
      const persist = createMockLevelPersist();
      const db = new Database(persist, null);

      const table = db.createTable("mods_pivot");
      expect(table).toBeInstanceOf(Table);
    });

    it("creates View instances", () => {
      const persist = createMockLevelPersist();
      const db = new Database(persist, null);

      const view = db.createView("profiles_view");
      expect(view).toBeInstanceOf(View);
    });
  });

  describe("query()", () => {
    it("executes raw SQL and returns typed results", async () => {
      const rows = [{ mod_id: "1", name: "test" }];
      const persist = createMockLevelPersist();
      persist.connection.runAndReadAll.mockResolvedValue({
        getRowObjectsJson: () => rows,
      });
      const db = new Database(persist, null);

      const result = await db.query<ModRow>("SELECT * FROM mods_pivot");

      expect(result).toEqual(rows);
    });
  });

  describe("transaction()", () => {
    it("commits on success", async () => {
      const persist = createMockLevelPersist();
      const invalidator = createMockInvalidator();
      const db = new Database(persist, invalidator);

      await db.transaction(async (tx) => {
        const mods = tx.createTable<ModRow>("mods_pivot");
        await mods.insert({ mod_id: "1", name: "test" });
      });

      expect(persist.beginTransaction).toHaveBeenCalledTimes(1);
      expect(persist.commitTransaction).toHaveBeenCalledTimes(1);
      expect(persist.rollbackTransaction).not.toHaveBeenCalled();
    });

    it("rolls back on error", async () => {
      const persist = createMockLevelPersist();
      const db = new Database(persist, null);

      await expect(
        db.transaction(async () => {
          throw new Error("boom");
        })
      ).rejects.toThrow("boom");

      expect(persist.beginTransaction).toHaveBeenCalledTimes(1);
      expect(persist.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(persist.commitTransaction).not.toHaveBeenCalled();
    });

    it("notifies invalidator with dirty tables on commit", async () => {
      const dirty = [{ database: "db", table: "mods_pivot", type: "write" }];
      const persist = createMockLevelPersist();
      persist.getDirtyTables.mockResolvedValue(dirty);
      const invalidator = createMockInvalidator();
      const db = new Database(persist, invalidator);

      await db.transaction(async () => {});

      expect(persist.getDirtyTables).toHaveBeenCalled();
      expect(invalidator.notifyDirtyTables).toHaveBeenCalledWith(dirty);
    });

    it("does not notify invalidator when no invalidator set", async () => {
      const persist = createMockLevelPersist();
      const db = new Database(persist, null);

      await db.transaction(async () => {});

      expect(persist.commitTransaction).toHaveBeenCalled();
    });
  });

  describe("autoTransaction()", () => {
    it("wraps a single write in BEGIN/COMMIT with invalidation", async () => {
      const dirty = [{ database: "db", table: "mods_pivot", type: "write" }];
      const persist = createMockLevelPersist();
      persist.getDirtyTables.mockResolvedValue(dirty);
      const invalidator = createMockInvalidator();
      const db = new Database(persist, invalidator);

      await db.autoTransaction(async (conn) => {
        await conn.run("INSERT INTO mods_pivot VALUES ($1, $2)", ["1", "a"]);
      });

      expect(persist.beginTransaction).toHaveBeenCalledTimes(1);
      expect(persist.getDirtyTables).toHaveBeenCalled();
      expect(persist.commitTransaction).toHaveBeenCalledTimes(1);
      expect(invalidator.notifyDirtyTables).toHaveBeenCalledWith(dirty);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test __tests__/store/Database.test.ts`
Expected: FAIL — `Cannot find module '../../src/main/store/Database'`

- [ ] **Step 3: Implement Database class**

```typescript
// src/main/store/Database.ts
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

  /**
   * Execute a function within an explicit transaction.
   * Auto-commits on success, auto-rolls-back on throw.
   * Fires query invalidation on commit.
   */
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

  /**
   * Wrap a single write operation in BEGIN/getDirtyTables/COMMIT.
   * Used internally by model layer for standalone writes outside explicit transactions.
   */
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test __tests__/store/Database.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/store/Database.ts __tests__/store/Database.test.ts
git commit -m "feat: add Database class with transaction support and factory methods"
```

---

## Chunk 2: Query Parser Extension and Code Generation

### Task 4: Add `-- @alias` annotation to query parser

**Files:**
- Modify: `src/main/store/queryParser.ts`
- Create: `__tests__/store/queryParser.test.ts`

- [ ] **Step 1: Write queryParser alias test**

```typescript
// __tests__/store/queryParser.test.ts
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseAllQueries } from "../../src/main/store/queryParser";

describe("queryParser", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qparser-"));
    fs.mkdirSync(path.join(tmpDir, "setup"));
    fs.mkdirSync(path.join(tmpDir, "select"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parses @alias annotation", () => {
    fs.writeFileSync(
      path.join(tmpDir, "select", "test.sql"),
      `-- @type select\n-- @name my_long_query_name\n-- @alias myQuery\nSELECT 1;\n`
    );

    const queries = parseAllQueries(tmpDir);

    expect(queries).toHaveLength(1);
    expect(queries[0].name).toBe("my_long_query_name");
    expect(queries[0].alias).toBe("myQuery");
  });

  it("alias is undefined when not specified", () => {
    fs.writeFileSync(
      path.join(tmpDir, "select", "test.sql"),
      `-- @type select\n-- @name simple_query\nSELECT 1;\n`
    );

    const queries = parseAllQueries(tmpDir);

    expect(queries[0].alias).toBeUndefined();
  });

  it("parses @alias on setup queries", () => {
    fs.writeFileSync(
      path.join(tmpDir, "setup", "test.sql"),
      `-- @type setup\n-- @name my_pivot\n-- @alias myModel\nSELECT 1;\n`
    );

    const queries = parseAllQueries(tmpDir);

    expect(queries[0].alias).toBe("myModel");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test __tests__/store/queryParser.test.ts`
Expected: FAIL — `alias` property does not exist on `ParsedQuery`

- [ ] **Step 3: Add alias parsing to queryParser.ts**

Modify `src/main/store/queryParser.ts`:

Add `alias?: string` to the `ParsedQuery` interface:
```typescript
export interface ParsedQuery {
  name: string;
  type: QueryType;
  sql: string;
  params: ParsedQueryParam[];
  description: string;
  filePath: string;
  alias?: string;
}
```

Add the regex alongside existing patterns:
```typescript
const ALIAS_RE = /^--\s*@alias\s+(\S+)\s*$/;
```

In the line-parsing loop, add a case for alias (alongside the existing `@name`, `@description`, `@param` cases):
```typescript
const aliasMatch = line.match(ALIAS_RE);
if (aliasMatch) {
  if (currentQuery) {
    currentQuery.alias = aliasMatch[1];
  }
  continue;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test __tests__/store/queryParser.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/store/queryParser.ts __tests__/store/queryParser.test.ts
git commit -m "feat: add @alias annotation support to query parser"
```

---

### Task 5: Extend code generator for pivot table types and Models interface

**Files:**
- Modify: `scripts/generate-query-types.ts`

The generator needs to:
1. Introspect pivot tables via `DESCRIBE` after running setup queries
2. Generate `*Row` interfaces for pivot tables (not just selects)
3. Generate a `Models` interface and `createModels()` factory
4. Apply naming convention (strip `_pivot`, camelCase) with `@alias` override
5. Keep existing `QueryParamsMap` / `QueryResultMap` generation working

Note: the existing `toPascalCase` function is reused as-is.

- [ ] **Step 1: Add helper functions for naming convention**

Add to `scripts/generate-query-types.ts`:

```typescript
/** Convert snake_case to camelCase */
function toCamelCase(name: string): string {
  return name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Derive model property name from SQL name using convention + alias */
function derivePropertyName(
  query: ParsedQuery,
  type: "table" | "view"
): string {
  if (query.alias) {
    return query.alias;
  }
  let name = query.name;
  if (type === "table" && name.endsWith("_pivot")) {
    name = name.slice(0, -"_pivot".length);
  }
  return toCamelCase(name);
}
```

- [ ] **Step 2: Add pivot table introspection to main()**

After running setup queries in `main()`, add:

```typescript
interface TableTypeInfo {
  query: ParsedQuery;
  propName: string;
  columns: Array<{ name: string; tsType: string }>;
}

const tableTypeInfos: TableTypeInfo[] = [];

for (const q of setupQueries) {
  console.log(`  Describing table: ${q.name}`);
  const descResult = await connection.runAndReadAll(
    `DESCRIBE db.${q.name}`
  );
  const descRows = descResult.getRowObjectsJson() as Array<{
    column_name: string;
    column_type: string;
  }>;

  const columns = descRows.map((row) => ({
    name: row.column_name,
    tsType: duckdbTypeToTS(row.column_type),
  }));

  tableTypeInfos.push({
    query: q,
    propName: derivePropertyName(q, "table"),
    columns,
  });
}
```

- [ ] **Step 3: Replace generateTypeScript function**

The new version produces Row types for both tables and selects, plus Models interface and createModels factory. Uses type-only imports so shared/ → main/ cross-boundary is safe.

```typescript
function generateTypeScript(
  tableTypeInfos: TableTypeInfo[],
  selectTypeInfos: Array<{
    query: ParsedQuery;
    columns: Array<{ name: string; tsType: string }>;
  }>,
): string {
  const lines: string[] = [];
  lines.push("// AUTO-GENERATED by scripts/generate-query-types.ts — DO NOT EDIT");
  lines.push("");
  lines.push('import type { Table } from "../../../main/store/Table";');
  lines.push('import type { View } from "../../../main/store/View";');
  lines.push('import type { Database } from "../../../main/store/Database";');
  lines.push("");

  // Pivot table Row interfaces
  for (const { query, columns } of tableTypeInfos) {
    const pascal = toPascalCase(query.name);
    lines.push(`/** Row type for the '${query.name}' pivot table */`);
    lines.push(`export interface ${pascal}Row {`);
    for (const col of columns) {
      lines.push(`  ${col.name}: ${col.tsType};`);
    }
    lines.push("}");
    lines.push("");
  }

  // Select query Params and Row interfaces
  for (const { query, columns } of selectTypeInfos) {
    const pascal = toPascalCase(query.name);

    if (query.params.length > 0) {
      lines.push(`/** Parameters for the '${query.name}' query */`);
      lines.push(`export interface ${pascal}Params {`);
      for (const param of query.params) {
        lines.push(`  ${param.name}: ${duckdbTypeToTS(param.duckdbType)};`);
      }
      lines.push("}");
    } else {
      lines.push(`/** Parameters for the '${query.name}' query (no parameters) */`);
      lines.push(`export type ${pascal}Params = Record<string, never>;`);
    }
    lines.push("");

    lines.push(`/** Result row for the '${query.name}' query */`);
    lines.push(`export interface ${pascal}Row {`);
    for (const col of columns) {
      lines.push(`  ${col.name}: ${col.tsType};`);
    }
    lines.push("}");
    lines.push("");
  }

  // Models interface
  lines.push("/** Typed model accessors — generated from SQL definitions */");
  lines.push("export interface Models {");
  for (const { query, propName } of tableTypeInfos) {
    const pascal = toPascalCase(query.name);
    lines.push(`  ${propName}: Table<${pascal}Row>;`);
  }
  for (const { query } of selectTypeInfos) {
    if (query.params.length === 0) {
      const pascal = toPascalCase(query.name);
      const propName = derivePropertyName(query, "view");
      lines.push(`  ${propName}: View<${pascal}Row>;`);
    }
  }
  lines.push("}");
  lines.push("");

  // createModels factory
  lines.push("/** Create typed model accessors from a Database instance */");
  lines.push("export function createModels(db: Database): Models {");
  lines.push("  return {");
  for (const { query, propName } of tableTypeInfos) {
    lines.push(`    ${propName}: db.createTable("${query.name}"),`);
  }
  for (const { query } of selectTypeInfos) {
    if (query.params.length === 0) {
      const propName = derivePropertyName(query, "view");
      lines.push(`    ${propName}: db.createView("${query.name}"),`);
    }
  }
  lines.push("  } as Models;");
  lines.push("}");
  lines.push("");

  // QueryParamsMap
  lines.push("/** Maps query names to their parameter types */");
  lines.push("export interface QueryParamsMap {");
  for (const { query } of selectTypeInfos) {
    const pascal = toPascalCase(query.name);
    lines.push(`  "${query.name}": ${pascal}Params;`);
  }
  lines.push("}");
  lines.push("");

  // QueryResultMap (now uses Row suffix)
  lines.push("/** Maps query names to their result row types */");
  lines.push("export interface QueryResultMap {");
  for (const { query } of selectTypeInfos) {
    const pascal = toPascalCase(query.name);
    lines.push(`  "${query.name}": ${pascal}Row;`);
  }
  lines.push("}");
  lines.push("");

  lines.push("/** All valid query names */");
  lines.push("export type QueryName = keyof QueryResultMap;");
  lines.push("");

  return lines.join("\n");
}
```

- [ ] **Step 4: Update main() to pass both table and select type infos**

Update the call at the bottom of `main()`:

```typescript
const output = generateTypeScript(tableTypeInfos, typeInfos);
```

Where `typeInfos` is the existing select query introspection array.

- [ ] **Step 5: Run the generator**

Run: `pnpm run gen:queries`
Expected: Generates `src/shared/types/generated/queryTypes.ts` with `ModsPivotRow`, `ProfilesPivotRow`, `Models` interface, and `createModels()` factory.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-query-types.ts src/shared/types/generated/queryTypes.ts
git commit -m "feat: extend code generator for pivot table Row types and Models interface"
```

---

## Chunk 3: Integration, Rename, and Verification

### Task 6: Rename `*Result` to `*Row` in existing consumer code

The type generator now produces `*Row` instead of `*Result`. Do this before integration so the build stays green.

- [ ] **Step 1: Search for references to old type names**

Run: `grep -rn "Result" src/shared/types/generated/queryTypes.ts src/renderer/ src/preload/ __tests__/ | grep -i "managedgames\|query.*result"`

- [ ] **Step 2: Update each reference from `*Result` to `*Row`**

Replace `RecentlyManagedGamesResult` with `RecentlyManagedGamesRow` in all files found.

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: rename generated query types from *Result to *Row"
```

---

### Task 7: Wire Database into mainPersistence.ts

**Files:**
- Modify: `src/main/store/mainPersistence.ts`

- [ ] **Step 1: Create and export Database instance**

In `src/main/store/mainPersistence.ts`, add:

```typescript
import { Database } from "./Database";

let database: Database | undefined;

export function getDatabase(): Database | undefined {
  return database;
}
```

In the `initMainPersistence` function, after the QueryInvalidator is created and before the function returns:

```typescript
database = new Database(levelPersistor, queryInvalidator);
```

- [ ] **Step 2: Verify the build compiles**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/main/store/mainPersistence.ts
git commit -m "feat: wire Database instance into main persistence layer"
```

---

### Task 8: Export public API from store

**Files:**
- Create: `src/main/store/models.ts` (barrel export)

- [ ] **Step 1: Create barrel export**

```typescript
// src/main/store/models.ts
export { View } from "./View";
export { Table } from "./Table";
export { Database } from "./Database";
export type { TransactionContext } from "./Database";
export { getDatabase } from "./mainPersistence";
```

- [ ] **Step 2: Verify build compiles**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/main/store/models.ts
git commit -m "feat: add barrel export for model layer public API"
```

---

### Task 9: Run full test suite and verify no regressions

- [ ] **Step 1: Run all tests**

Run: `pnpm run test`
Expected: All existing tests pass, all new tests pass

- [ ] **Step 2: Run linter**

Run: `pnpm run lint`
Expected: No new lint errors

- [ ] **Step 3: Fix any issues found, then commit**

```bash
git add -A
git commit -m "fix: resolve any test/lint regressions from model layer"
```

(Skip this commit if no fixes are needed.)
