# Agent Instructions

Project and coding documentation lives in [docs/](docs/README.md). This file
covers only how to operate in this repo as an agent: verification, and which doc
to load for a task. It deliberately duplicates nothing from `docs/`.

## Verification

`pnpm run verify` from the repo root.

Scope a single test with `pnpm run test -- <path>`.

`verify` **excludes the E2E suite** (`@vortex/e2e`), which needs a packaged app
and a real game install. Passing it is not evidence that E2E passes, so say which
suite you ran. Run E2E only when asked.

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

## Which doc to read

Read the doc for the area you're touching rather than the whole tree.
`docs/README.md` is the full index; this is the shortcut.

- Finding your way around the repo: `docs/repo-layout.md`
- Renderer, React, UI: `docs/frontend.md`
- Writing or fixing tests: `docs/testing.md`
- Debugging, logs, diagnostics: `docs/DEBUGGING-GUIDE.md`
- Collections, phased install: `docs/mod-management/collections.md`
- Installers, release pipeline: `docs/packaging/windows.md`
- The auto-updater: `docs/updater.md`
- Writing documentation: `docs/writing-documentation.md`
- Code style: `CODESTYLE.md`
