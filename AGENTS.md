# Agent Instructions

Prefix with `pnpm run`:

- `build:all` - Build everything
- `start` - Dev mode
- `test` - Run tests
- `lint` - ESLint
- `format` - Formatter

After changes: run `build`, `test`, `lint`, `format` on affected package.

## Key Directories

- `src/main/src/` - Main Electron process
- `src/renderer/src/` - Renderer (actions/, reducers/, controls/, views/, util/, types/)
- `src/shared/src/` - Shared modules, types, API
- `extensions/games/` - Game extensions

## Conditional Context

- For testing: read `AGENTS-TESTING.md`
