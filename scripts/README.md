# Scripts - Build & Development Utilities

Build and development scripts for the Vortex workspace.

## Prerequisites

Most scripts require dependencies installed via `pnpm install`. Scripts that
additionally need a prior `pnpm build` are noted below.

## Scripts

### `create-env-file.mjs`

Writes `.local.env` with `NX_PARALLEL` set to the host CPU count.

```bash
node scripts/create-env-file.mjs
```

### `dependency-report.mjs`

Generates `etc/Dependency Report.md` - a table of all production dependencies
leaked by Vortex to extensions via `nodeIntegration`.

```bash
node scripts/dependency-report.mjs
```

### `extensions-rolldown.mjs`

Shared Rolldown helpers for bundled in-repo extensions. Exports `getExternals()`,
`nativeRemapPlugin()`, `createConfig()`, and `bundle()`. Not run directly -
imported by extension build configs.

### `generate-query-types.ts`

Generates TypeScript interfaces from the SQL query definitions in `src/queries/`.
Creates a temporary DuckDB instance, introspects column types, and writes
`src/main/src/store/generated/queryTypes.ts`.

```bash
pnpm run generate:query-types
```

Requires: `pnpm build`

### `download-duckdb-extensions.ts`

Downloads pre-built DuckDB extension binaries (`.duckdb_extension`) for the
platforms and extensions listed in `duckdb-extensions.json`. Detects the DuckDB
version from the installed `@duckdb/node-api` package.

```bash
npx tsx scripts/download-duckdb-extensions.ts
```

### `check-package-build-setup.test.ts`

Vitest test that scans workspace packages under `packages/` and verifies each
has a `build` script and that runtime entry points (`main`, `module`, `exports`)
point to compiled output rather than `.ts` source.

```bash
pnpm exec vitest run --root scripts
```

## Project Structure

```
scripts/
  create-env-file.mjs            - .local.env generator
  dependency-report.mjs           - production dependency report
  extensions-rolldown.mjs        - shared Rolldown bundling helpers
  generate-query-types.ts         - SQL -> TypeScript type generator
  download-duckdb-extensions.ts   - DuckDB extension downloader
  download-duckdb-extensions.test.ts
  check-package-build-setup.test.ts
  duckdb-extensions.json          - platform/extension config
  vitest.config.ts               - Vitest config for scripts test suite
```

## Running

```bash
# .mjs scripts - run directly with Node
node scripts/create-env-file.mjs
node scripts/dependency-report.mjs

# .ts scripts - run via tsx
npx tsx scripts/generate-query-types.ts
npx tsx scripts/download-duckdb-extensions.ts

# Tests
pnpm exec vitest run --root scripts
```
