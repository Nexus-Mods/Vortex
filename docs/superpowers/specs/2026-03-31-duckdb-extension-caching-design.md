# DuckDB Extension Pre-Caching Design

**Linear:** APP-204
**Date:** 2026-03-31
**Status:** Approved

## Problem

`DuckDBSingleton.initialize()` calls `FORCE INSTALL level_pivot FROM '...'` on every startup. This always re-downloads the extension from a remote URL, adding latency and requiring network access. There is no offline fallback.

## Goals

- Bundle DuckDB extensions inside the app installer (fully offline at runtime)
- Support Windows (x64) and Linux (x64)
- Make adding future extensions a one-line config change
- Support both custom HTTP-hosted extensions and official DuckDB community extensions

## Design

### 1. Config file — `scripts/duckdb-extensions.json`

Committed to the repo. Lists all extensions to pre-download and the target platforms.

```json
{
  "platforms": ["windows_amd64", "linux_amd64"],
  "outputDir": "src/main/build/duckdb-extensions",
  "extensions": [
    {
      "name": "level_pivot",
      "type": "http",
      "repository": "https://halgari.github.io/duckdb-level-pivot/current_release"
    }
  ]
}
```

**Extension types:**

| Type | Description | Required fields |
|------|-------------|-----------------|
| `http` | Custom HTTP-hosted extension | `repository` — base URL |
| `community` | Official DuckDB community registry | none (URL inferred) |

Adding a new extension = one new object in the `extensions` array.

### 2. Build script — `scripts/download-duckdb-extensions.ts`

Run with `npx tsx`. Does the following:

1. **Detect DuckDB version** — reads `node_modules/@duckdb/node-api/package.json`, strips the `-r.X` suffix from the version field (e.g. `1.5.1-r.1` → `v1.5.1`)
2. **Construct download URL per extension × platform:**
   - `http`: `{repository}/{version}/{platform}/{name}.duckdb_extension`
   - `community`: `https://community-extensions.duckdb.org/v1/{version}/{platform}/{name}.duckdb_extension`
3. **Download** each binary to `{outputDir}/{version}/{platform}/{name}.duckdb_extension`
4. **Skip** files that already exist (idempotent — safe to re-run on every build)

Output directory (`src/main/build/duckdb-extensions/`) is gitignored.

### 3. Runtime changes — `DuckDBSingleton`

`initialize()` gains an `extensionDir: string` parameter. The DuckDB instance is created with `extension_directory` set, and `FORCE INSTALL` + `LOAD` is replaced with just `LOAD`:

```ts
// Before
await DuckDBInstance.create(":memory:", { allow_unsigned_extensions: "true" });
await connection.run("FORCE INSTALL level_pivot FROM '...'");
await connection.run("LOAD level_pivot");

// After
await DuckDBInstance.create(":memory:", {
  allow_unsigned_extensions: "true",
  extension_directory: extensionDir,
});
await connection.run("LOAD level_pivot");
```

The `extensionDir` path is resolved in `Application.ts` (Electron main process) and threaded through `mainPersistence` → `LevelPersist` → `singleton.initialize()`:

- **Production:** `path.join(process.resourcesPath, 'duckdb-extensions')`
- **Development:** `path.join(app.getAppPath(), '../../src/main/build/duckdb-extensions')`

The existing idempotency guard (`if (this.#mInitialized) return`) means the path is only used on the first call.

### 4. Packaging — `electron-builder.config.json`

One new entry in `extraResources` (path relative to `src/main/`):

```json
{ "from": "./build/duckdb-extensions", "to": "duckdb-extensions" }
```

Extensions land outside the asar at `resources/duckdb-extensions/` in the installed app.

### 5. Build pipeline integration

New root-level npm script:
```
"duckdb:extensions": "npx tsx scripts/download-duckdb-extensions.ts"
```

Hooked into both build pipelines so extensions are always present before packaging or dev startup:

- **`dist:all`** — append `&& pnpm run duckdb:extensions` (runs before electron-builder)
- **`build:assets`** — append `&& pnpm run duckdb:extensions` (dev builds)

Since `package` and `package:nosign` both invoke `dist:all` first, the extensions are guaranteed to be downloaded before electron-builder reads `extraResources`.

## File changes summary

| File | Change |
|------|--------|
| `scripts/duckdb-extensions.json` | New — extension config |
| `scripts/download-duckdb-extensions.ts` | New — download script |
| `src/main/src/store/DuckDBSingleton.ts` | Add `extensionDir` param to `initialize()`, replace FORCE INSTALL with LOAD |
| `src/main/src/store/LevelPersist.ts` | Thread `extensionDir` through to `initialize()` |
| `src/main/src/store/mainPersistence.ts` | Thread `extensionDir` down from caller |
| `src/main/src/Application.ts` | Resolve `extensionDir` path, pass to persistence layer |
| `src/main/electron-builder.config.json` | Add `extraResources` entry for `duckdb-extensions` |
| `package.json` | Add `duckdb:extensions` script; update `dist:all` and `build:assets` |
| `.gitignore` | Add `src/main/build/duckdb-extensions/` |

## Out of scope

- macOS support (not a current target)
- Extension signature verification
- Automatic cleanup of old version directories
