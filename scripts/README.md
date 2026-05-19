# Scripts

Standalone build and release scripts. These are not part of any app package
and are intended for developers maintaining the Vortex repository.

---

## Prerequisites

Before running any scripts, install dependencies:

```bash
pnpm install
```

This also runs the `preinstall` hook which creates `.local.env` with
`NX_PARALLEL` set to your CPU core count.

---

## How to Run

| Script type                     | Invocation                   |
| ------------------------------- | ---------------------------- |
| `.js` (CommonJS)                | `node scripts/<name>.js`     |
| `.mjs` (ESM/ECMAScript Modules) | `node scripts/<name>.mjs`    |
| `.ts` (TypeScript)              | `pnpm tsx scripts/<name>.ts` |

Scripts wired into `package.json` can also be called with `pnpm run <name>`.

---

## Build and Assets

- `download-duckdb-extensions.ts` -- downloads platform-specific DuckDB
  extensions listed in `duckdb-extensions.json`. Run via `pnpm run assets`.

- `dependency-report.mjs` -- generates `etc/Dependency Report.md` listing
  production dependencies accessible to extensions via Node.js integration
  (nodeIntegration). Run via `pnpm run assets`.

- `extensions-rolldown.mjs` -- shared Rolldown bundler helpers for bundling
  in-repo extensions. Keeps core Vortex packages (e.g., `@vortex/*`) external
  (not inlined into the bundle; resolved at runtime) and remaps native module
  imports to their runtime paths. Extension build configs import this module;
  do not run it directly.

- `create-env-file.mjs` -- writes `.local.env` with `NX_PARALLEL` set to the
  number of CPU cores. Runs automatically on `pnpm install`.

- `generate-query-types.ts` -- generates TypeScript interfaces from SQL query
  definitions in `src/queries/`. Run via `pnpm run generate:query-types`.

---

## Release and Versioning

- `publish-release-to-nexus/` -- prepares and uploads a Vortex release to
  Nexus Mods (a mod distribution platform). Run from `index.ts`.
  Run via `pnpm tsx scripts/publish-release-to-nexus/index.ts`.

---

## TypeScript Editor Support

The `.ts` files in this directory are standalone Node scripts run via
`pnpm tsx`. They are not part of any app package. `tsconfig.node.json` (repo
root) provides type checking and includes `"./scripts/**/*.ts"` so the editor
resolves `node:*` imports.
