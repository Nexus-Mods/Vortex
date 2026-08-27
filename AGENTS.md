# Agent Instructions

Project and coding documentation lives in [docs/](docs/README.md). This file
covers only how to operate in this repo as an agent: commands, tools, and which
doc to load for a task. It deliberately duplicates nothing from `docs/`.

## Verification

Run these from the repo root. They fan out through Nx to every affected package,
so there is no need to change directory into one.

- `pnpm run build` - **already runs lint and typecheck**, so you don't need to
  run those separately
- `pnpm run test`
- `pnpm run format`

Scope a single test with `pnpm run test -- <path>`.

`pnpm run test` **excludes the E2E suite** (`@vortex/e2e`), which needs a
packaged app and a real game install. Passing it is not evidence that E2E
passes, so say which suite you ran. Run E2E only when asked.

Formatting, import order and Tailwind class order are owned by oxfmt and oxlint.
Don't hand-fix them; run `pnpm run format` and let it win.

## Committing

A pre-commit hook runs `oxfmt` over every staged file, markdown included, so
expect your formatting to be rewritten: tables reflowed, emphasis markers
normalised. Don't fight it, and don't re-edit afterwards to undo it. Running
`pnpm run format` before you commit makes the hook a no-op.

The hook may also trigger a dependency install mid-commit, so a commit can take
about 30 seconds and print install output. That's normal.

Don't commit, push, or open a PR unless asked. Leave changes in the working tree
for review. If you're on `master`, branch first.

## Toolchain

Node and pnpm are pinned exactly: Volta pins node 24.17.0, `packageManager` pins
pnpm 11.10.0 with an integrity hash, and `engines` requires node 24.17.0. Use
`pnpm`. Never `npm install` or `yarn`, and don't bump those versions unless
asked.

## Tool use

- Prefer harness file tools (read, edit, glob, grep) over shelling out to
  `cat`, `sed` or `Get-Content`. Faster, and the edits are reviewable.
- Don't write a throwaway script to do what an edit tool does.
- The default shell is PowerShell on Windows. Anything committed to `scripts/`
  should be cross-platform Node.
- Never run the signed `pnpm package` locally; signing secrets are CI-only. See
  [docs/packaging/windows.md](docs/packaging/windows.md).
- When explaining code, cite `path:line` so the claim can be checked.

## MCP servers

**chrome-devtools** is configured for this repo (`.mcp.json`) and attaches to a
running Vortex on `127.0.0.1:9222`. Vortex has to be running with remote
debugging first: `pnpm run dev`, or the VS Code "Debug Electron" profile. Use it
to inspect live renderer state, console and network rather than adding temporary
logging, which tends to get committed by accident.

**Linear**, if available in your environment (it's user-scoped, not configured
by this repo): fetch ticket context by ID instead of asking for a paste. Don't
create or transition issues unless asked.

## Skills

`.claude/skills/` holds repo skills. Prefer them over improvising:

- `watch-log` - tailing and investigating Vortex logs
- `changelog` - drafting a `CHANGELOG.md` entry
- `e2e-test` - scaffolding a Playwright E2E spec

## Which doc to read

Read the doc for the area you're touching rather than the whole tree.
[docs/README.md](docs/README.md) is the full index; this table is the shortcut.

| Working on                       | Read                                                                     |
| -------------------------------- | ------------------------------------------------------------------------ |
| Finding your way around the repo | [docs/repo-layout.md](docs/repo-layout.md)                               |
| Renderer, React, UI              | [docs/frontend.md](docs/frontend.md)                                     |
| Writing or fixing tests          | [docs/testing.md](docs/testing.md)                                       |
| Debugging, logs, diagnostics     | [docs/DEBUGGING-GUIDE.md](docs/DEBUGGING-GUIDE.md)                       |
| Collections, phased install      | [docs/mod-management/collections.md](docs/mod-management/collections.md) |
| Installers, release pipeline     | [docs/packaging/windows.md](docs/packaging/windows.md)                   |
| The auto-updater                 | [docs/updater.md](docs/updater.md)                                       |
| Writing documentation            | [docs/writing-documentation.md](docs/writing-documentation.md)           |

Code style is [CODESTYLE.md](CODESTYLE.md).
