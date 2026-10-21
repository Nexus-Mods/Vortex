# Agent Instructions

Project and coding documentation lives in [docs/](docs/README.md). This file
covers only how to operate in this repo as an agent: verification, and which doc
to load for a task. It deliberately duplicates nothing from `docs/`.

## Verification

`pnpm run verify` from the repo root.

Scope a single test with `pnpm exec vitest run <file>` from inside the project
directory that owns it (e.g. `cd src/renderer` first). `pnpm run test` runs the
whole suite via nx and cannot be scoped.

`verify` **excludes the E2E suite** (`@vortex/e2e`), which needs a packaged app
and a real game install. Passing it is not evidence that E2E passes, so say which
suite you ran. Run E2E only when asked.

**Don't run `verify` while a dev session is live** — its `build` step writes
production output into `src/main/build`, the directory the running app loads
from. That overwrites the CSS `tailwind:watch` owns (watch only re-emits on a
source change, so it never notices) and replaces the HMR renderer bundle,
leaving the app with broken styles and dead HMR until dev is restarted.

You know a dev session is live if you started `pnpm run dev` or the "Debug
Electron" profile yourself, or if the user has one running: they'll have said
so, or asked you to use the chrome-devtools MCP or watch logs, both of which
need a live app. If in any doubt, ask before running `verify`.

While a dev session is running, use checks that don't write there: `pnpm run
typecheck` and `pnpm run lint`, plus `pnpm exec vitest run <file>` from inside
the owning project directory for a single test. `pnpm run format` is safe. Save
`verify` for the end.

Formatting, import order and Tailwind class order are owned by oxfmt and oxlint.
Don't hand-fix them; let the formatter win.

## Committing

Don't commit, push, or open a PR unless asked. Leave changes in the working tree
for review. If you're on `master`, branch first.

## Tool use

- Anything committed to `scripts/` should be cross-platform Node.
- Never run the signed `pnpm package` locally; signing secrets are CI-only. See
  `docs/packaging/windows.md`.

## MCP servers

**chrome-devtools** attaches to a running Vortex on `127.0.0.1:9222`, so Vortex
has to be started with remote debugging first: `pnpm run dev`, or the VS Code
"Debug Electron" profile. Use it to inspect live renderer state rather than
adding temporary logging, which tends to get committed by accident.

**Linear**: don't create or transition issues unless asked.

## Game IDs

`GameId` is the numeric Nexus Mods id (e.g. 1303), `GameDomain` the nexus
domain slug (e.g. `stardewvalley`), and `VortexGameId` the id Vortex gives a
game internally (the extension's game id, or the domain for extension-less
games); all three are branded types in `src/shared/src/types/ids.ts`. They are
different concepts even where their values coincide, so don't interchange
them.

- Don't accept or produce raw `string`/`number` where a branded type applies. Brand at the boundary from data that genuinely is that kindand keep the brand flowing.
- Don't cast across brands (`GameDomain(someVortexGameId)`). A branded type says where the value came from; guessing the origin defeats it.
- Comparisons between different brands are a type error **on purpose**. When you hit one, it means "find the real join", not "cast it", the type checker is pointing at data you don't actually have.
- Don't write ad-hoc lookups over the games list for an id you already have a helper for; if a join is missing, add it next to the existing ones.

## Which doc to read

Read the doc for the area you're touching rather than the whole tree.
`docs/README.md` is the full index; this is the shortcut.

- Finding your way around the repo: `docs/repo-layout.md`
- Renderer, React, UI: `docs/frontend.md`
- Redux state, reducers, actions: `docs/state.md`
- Writing or fixing tests: `docs/testing.md`
- Debugging, logs, diagnostics: `docs/DEBUGGING-GUIDE.md`
- Collections, phased install: `docs/mod-management/collections.md`
- Installers, release pipeline: `docs/packaging/windows.md`
- The auto-updater: `docs/updater.md`
- Writing documentation: `docs/writing-documentation.md`
- Code style: `CODESTYLE.md`
