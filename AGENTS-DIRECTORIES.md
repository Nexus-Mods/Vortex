# Directory Guide

Use this file for repo navigation and code search.

## Core App

- `src/main/src/` - Electron main process: app startup, windows, IPC, downloads, telemetry, extension loading
- `src/renderer/src/` - React renderer: `views/`, `controls/`, `actions/`, `reducers/`, `store/`, `util/`, `extensions/`
- `src/shared/src/` - Shared APIs, types, telemetry, cross-process utilities
- `src/preload/src/` - Electron preload bridge
- `src/queries/` - Database/query setup: `select/`, `setup/`
- `src/stylesheets/` - Shared stylesheets and Tailwind/Sass inputs

## Extensions

- `extensions/` - Bundled feature extensions
- `extensions/games/` - Game-specific extensions, one folder per game (`game-*`)

Common extension examples:

- `extensions/collections/` - Collections support
- `extensions/fomod-installer/` - FOMOD installer logic
- `extensions/mod-dependency-manager/` - Mod dependency handling
- `extensions/gamebryo-plugin-management/` - Bethesda plugin management

## Packages

- `packages/vortex-api/` - Extension-facing API package
- `packages/paths/` - Shared path abstractions
- `packages/paths-node/` - Node-specific path/filesystem helpers
- `packages/game-extension-helpers/` - Shared helpers for game extensions
- `packages/install-entries/` - Install entry types/helpers
- `packages/e2e/` - End-to-end tests

## Supporting Areas

- `docs/` - Architecture, debugging, release, and maintenance docs
- `scripts/` - Workspace/build/automation scripts
- `tools/` - One-off utilities and build helpers
- `assets/` - Static bundled assets
- `locales/` - Translations
- `samples/sample-extension/` - Reference extension scaffold
- `eslint-rules/` - Custom ESLint rules

## Start Here

- UI/component work: `src/renderer/src/views/` or `src/renderer/src/controls/`
- Renderer state changes: `src/renderer/src/actions/`, `reducers/`, `store/`
- Main-process behavior: `src/main/src/`
- IPC wiring: `src/main/src/ipc*.ts` and `src/shared/src/api/`
- Shared types or utilities: `src/shared/src/`
- Bundled feature behavior: `extensions/`
- Game-specific behavior: `extensions/games/`
- Extension API changes: `packages/vortex-api/`
- Path logic: `packages/paths/` or `packages/paths-node/`

## Usually Ignore

- `dist/`, `src/main/out/`, `src/main/dist/` - Build output
- `test-results/` - Test artifacts
- `node_modules/` - Dependencies
