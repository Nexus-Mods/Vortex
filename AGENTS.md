# Development Guide

## Technology Stack

- Electron 37.4.0, React 16.12.0, TypeScript, Redux
- Bootstrap/SASS for styling
- Jest for testing, ESLint for code quality
- Yarn 1.x for package management

## Commands

### Build & Development

- `yarn build` - Build for development (TypeScript to `out/`)
- `yarn buildwatch` - Build and watch for changes
- `yarn start` - Start in development mode
- `yarn subprojects` - Build bundled extensions
- `yarn buildext` - Build single extension

### Test & Quality

- `yarn test` - Run Jest tests
- `yarn lint` - Run ESLint

### Production

- `yarn dist` - Full production build with installers
- `yarn package` - Build electron package without installer

## Architecture

Electron-based mod manager with Redux state management.

### Core Structure

- **Main Process**: `src/main.ts`
- **Renderer Process**: `src/renderer.tsx`
- **Extensions**: `src/extensions/` (embedded) and `extensions/` (bundled)
- **State**: Redux actions in `src/actions/`, reducers in `src/reducers/`

### Key Directories

- `extensions/` - Bundled extensions (dynamically loaded)
- `src/extensions/` - Embedded extensions (statically loaded)
- `src/controls/` - Reusable React components
- `src/views/` - Main UI views
- `src/util/` - Utility helpers
- `src/types/` - TypeScript definitions
- `app/` - Production build staging
- `out/` - Development build output

## Extension Development

Extensions add functionality: game support, UI tools, service integrations.

- Game extensions live in `extensions/games/`
- Use `yarn buildext` to build individual extensions

## Native Modules

C++ and C# native modules managed as separate Git repositories.

- Status: `yarn modules:status` / `yarn modules:summary`
- Create branch: `yarn modules:create-branch <name>`
- For creating PRs across repos: tell user to use `/open-prs` slash command

## Conditional Context

- For debugging instructions: read `AGENTS-DEBUGGING.md`
- When working with `src/extensions/mod_management/InstallManager.ts`: read `AGENTS-COLLECTIONS.md`
- When writing or modifying tests: read `AGENTS-TESTING.md`
