# Development Guide

## Essential Commands

- `pnpm run build:all` - Build everything
- `pnpm run start` - Start in development mode
- `pnpm run test` - Run tests
- `pnpm run lint` - Run ESLint
- `pnpm run format` - Run formatter

**After code changes:** Run `build`, `test`, `lint`, and `format` on affected package.

## Key Directories

- `src/main/src/` - Main Electron process
- `src/renderer/src/` - Renderer (actions/, reducers/, controls/, views/, util/, types/)
- `src/shared/src/` - Shared modules, types, API
- `extensions/games/` - Game extensions (87 games)
- `src/main/out/` - Development build output

## Conditional Context

- For testing: read `AGENTS-TESTING.md`
