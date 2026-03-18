# DuckDB Model Layer Design

## Context

Vortex is migrating business logic from the renderer process to the main process. DuckDB (via level_pivot) already runs in-process in main, backed by the existing LevelDB on-disk format. Today, the renderer accesses DuckDB over IPC. With logic moving to main, main-process code (including upcoming YAML-driven Game Adaptors) becomes the primary consumer of query results — meaning direct, zero-IPC access to typed data.

The current PR (`duckdb-integration`) establishes: DuckDB singleton, level_pivot bridge, SQL-defined pivot tables, build-time type generation, IPC query channel, and renderer `useQuery` hook.

This design adds a typed model layer on top of that foundation.

## Constraints

- LevelDB on-disk format is unchanged
- level_pivot pivot tables are fully read/write (INSERT, UPDATE, DELETE propagate to LevelDB keys)
- level_pivot supports transactions (BEGIN, COMMIT, ROLLBACK) with dirty table tracking
- Renderer's existing `persist:diff` → `ReduxPersistorIPC` write path stays as-is
- Renderer's `useQuery` hook and IPC query channel stay as-is

## Architecture

```
Main Process (in-process, no IPC)
├── DuckDBSingleton (exists)
│   └── level_pivot → LevelDB on disk (unchanged)
├── Database
│   ├── transaction(fn) → scoped commit/rollback
│   ├── query<T>(sql, params) → raw typed SQL escape hatch
│   └── models: Models (generated)
│       ├── mods: Table<ModsPivotRow>
│       ├── profiles: Table<ProfilesPivotRow>
│       └── recentlyManagedGames: View<RecentlyManagedGamesRow>
│
├── Game Adaptors (future, YAML) → use models directly
├── Business logic (migrating here) → use models directly
│
└── Renderer IPC (existing, unchanged)
    ├── persist:diff → ReduxPersistorIPC → LevelDB (existing write path)
    ├── query:execute → runs against same models/views
    └── query:invalidated ← fired on commit from either write path

Renderer Process
├── useQuery() hook → IPC → main → models → results
└── Redux + persist:diff → IPC → main → LevelDB (existing)
```

## Components

### View\<T\> (read-only typed access)

Backed by a SQL view or non-parameterized select query. Provides:

- `all(): T[]` — return all rows (snapshot — query executes, results materialized into array)
- `where(filter: Partial<T>): T[]` — filter by column values
- `findOne(filter: Partial<T>): T | null` — first match or null
- Iterable — supports `for...of`

All results are snapshots: the query runs, rows are materialized into an array, and the array is returned. No live cursors.

Parameterized select queries (those with `-- @param`) are NOT exposed as `View<T>`. They remain accessible via `db.query<T>(name, params)` which returns typed results using the existing `QueryParamsMap` / `QueryResultMap` types.

### Table\<T\> extends View\<T\> (read/write typed access)

Backed by a writable level_pivot pivot table. Adds:

- `insert(row: T)` / `insertMany(rows: T[])`
- `update(where: Partial<T>, set: Partial<T>)` — empty `set` is a no-op
- `delete(where: Partial<T>)` — empty `where` throws (prevents accidental full-table delete)

Writes go through the pivot table, which level_pivot translates to LevelDB key operations. All operations throw on DuckDB/LevelDB errors (constraint violations, I/O errors, etc.).

### Database (connection + transaction manager)

Uses a single DuckDB connection shared with `ReduxPersistorIPC`. DuckDB serializes writes, so only one write can be in-flight at a time. This is acceptable because all writes happen in the main process event loop (no parallel write threads).

- `models: Models` — direct access; each write operation internally wraps in BEGIN/getDirtyTables/COMMIT to ensure invalidation fires
- `transaction(fn: (tx) => Promise<void>)` — `tx.models` is bound to the transaction; auto-commit on success, auto-rollback on throw; dirty tables checked once at commit
- `query<T>(sql, params): T[]` — escape hatch for raw SQL not covered by models
- On commit, wires into existing `QueryInvalidator` via dirty table tracking

### Models (generated interface)

A typed object with real property names — no magic strings:

```typescript
export interface Models {
  mods: Table<ModsPivotRow>;
  profiles: Table<ProfilesPivotRow>;
  // Parameterized selects accessed via db.query(), not as View properties
}
```

Property names derived by convention (strip `_pivot`, camelCase) with optional `-- @alias` override in SQL.

## SQL Files (source of truth)

All schema and query definitions live in SQL files under `src/queries/`:

- `setup/*.sql` — pivot table definitions via `level_pivot_create_table()` → generate `Table<T>`
- `view/*.sql` — SQL view definitions (`CREATE VIEW`) → generate `View<T>`
- `select/*.sql` — named select queries → non-parameterized become `View<T>` on `Models`, parameterized stay as typed `db.query()` calls

Existing annotation format, extended:

```sql
-- @type setup|view|select
-- @name query_name
-- @description Optional description
-- @alias propertyName        ← NEW: optional, overrides convention
-- @param param_name TYPE     ← for select queries
```

### Naming convention

- Tables: strip `_pivot` suffix, camelCase. `mods_pivot` → `mods`, `profiles_pivot` → `profiles`
- Views/selects: camelCase the full name. `recently_managed_games` → `recentlyManagedGames`
- `-- @alias` overrides convention when present (e.g. `-- @alias recentGames` to shorten)

## Build-Time Type Generation

Extends the existing `generate-query-types.ts` pipeline. Produces `src/shared/types/generated/queryTypes.ts` with:

- Row interfaces per table and view (suffix `Row` instead of current `Result` — e.g. `ModsPivotRow`, `ProfilesPivotRow`, `RecentlyManagedGamesRow`)
- `Models` interface mapping property names to `Table<T>` or `View<T>`
- `createModels(db: Database): Models` factory function
- `QueryParamsMap` and `QueryResultMap` (existing, unchanged)

### How pivot table types are introspected

The existing generator introspects select queries via `connection.prepare()`. For setup queries (pivot tables), the generator:

1. Runs the `level_pivot_create_table()` call against a temp empty LevelDB (already does this)
2. Runs `DESCRIBE db.mods_pivot` (or equivalent) to get column names and DuckDB types
3. Maps DuckDB types to TypeScript types using the existing `duckdbTypeToTS()` function

This avoids parsing the SQL string arguments and uses DuckDB's own schema introspection.

## Transaction Lifecycle

```typescript
await db.transaction(async (tx) => {
  tx.models.mods.insert({ mod_id: "skyui", name: "SkyUI", state: "installed" });
  tx.models.mods.insert({ mod_id: "ussep", name: "USSEP", state: "installed" });
  tx.models.profiles.update(
    { profile_id: activeProfile },
    { lastActivated: Date.now() }
  );
  // auto-commit on success, auto-rollback on throw
});
```

- Outside a transaction, each write via `models.*` internally wraps in BEGIN/getDirtyTables/COMMIT so invalidation always fires correctly
- `tx.models` provides the same `Models` shape but bound to the transaction connection — dirty tables are checked once at commit, not per-operation
- On commit: `getDirtyTables()` → `QueryInvalidator` → broadcasts `query:invalidated` to renderer
- Reads (`all`, `where`, `findOne`) do not open transactions

## Invalidation

Unchanged from existing design. Both write paths feed the same invalidation system:

1. Main-process writes (via `models.*`) → transaction commit → dirty tables → invalidator
2. Renderer writes (via `persist:diff` IPC) → `ReduxPersistorIPC` → dirty tables → invalidator

`QueryInvalidator` maps dirty tables → affected views/queries, debounces (16ms), broadcasts to all renderer windows. Renderer `useQuery` hooks re-fetch only affected queries.

## What Stays The Same

- LevelDB on-disk format
- `DuckDBSingleton`
- `level_pivot` extension
- Renderer `persist:diff` → `ReduxPersistorIPC` write path
- `QueryInvalidator` and dirty table tracking (gains more writers)
- `useQuery` hook (still works over IPC)
- Renderer Redux store (still owns renderer state)
