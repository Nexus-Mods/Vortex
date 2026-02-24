# Development Guide

## Technology Stack

- Electron 37.4.0, React 16.12.0, TypeScript, Redux
- Bootstrap/SASS for styling
- Jest for testing, ESLint for code quality
- PNPM workspaces for package management

## Commands

### Initial Setup

- `volta install node@22 yarn@v1` - toolchain setup
- `pnpm run build:fomod && pnpm install` - Setup dependencies

### Development Iteration

- `pnpm run build` - Build for development (TypeScript to `src/main/out/`)
- `pnpm run assets:out` - Build/copy runtime assets to `src/main/out/`
- `pnpm run subprojects:out` - Build bundled extensions for development
- `pnpm run start` - Start in development mode

### Test & Quality

- `pnpm run test` - Run Jest tests
- `pnpm run lint` - Run ESLint

### Packaging

- `pnpm run dist` - Build production bundles
- `pnpm run assets:dist` - Build/copy runtime assets to `src/main/dist/`
- `pnpm run subprojects:dist` - Build bundled extensions for packaging
- `pnpm run package` - Build electron package with signing
- `pnpm run package:nosign` - Build electron package without signing

## Architecture

Electron-based mod manager with Redux state management.

### Core Structure

- **Main Process**: `src/main/main.ts`
- **Renderer Process**: `src/renderer/renderer.tsx`
- **Preload Process**: `src/preload/index.ts`
- **Extensions**: `src/extensions/` (embedded) and `extensions/` (bundled)
- **State**: Redux actions in `src/actions/`, reducers in `src/reducers/`

### Key Directories

- `src/controls/` - Reusable React components
- `src/views/` - Main UI views
- `src/util/` - Utility helpers
- `src/types/` and `src/shared/types/` - TypeScript definitions
- `src/shared/` - Shared modules (path system, shared utilities)
- `src/main/dist/` - Production build staging
- `src/main/out/` - Development build output

## Extension Development

Extensions add functionality: game support, UI tools, service integrations.

- Game extensions live in `extensions/games/`
- Use `pnpm run subprojects:out` to build bundled extensions

## Native Modules

C++ and C# native modules managed as separate Git repositories.

- Status: `node scripts/manage-node-modules.js status` / `node scripts/manage-node-modules.js summary`
- Create branch: `node scripts/manage-node-modules.js create-branch <name>`
- For creating PRs across repos: tell user to use `/open-prs` slash command

## Conditional Context

- For debugging instructions: read `AGENTS-DEBUGGING.md`
- When working with `src/extensions/mod_management/InstallManager.ts`: read `AGENTS-COLLECTIONS.md`
- When writing or modifying tests: read `AGENTS-TESTING.md`
