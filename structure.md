# Project structure

- **/**: project root (workspace config, build scripts, docs)
  - **src/main/**: Electron main process source (`main.ts`) and packaging config
  - **src/renderer/**: Electron renderer source (`renderer.tsx`) and UI logic
  - **src/preload/**: Electron preload scripts (`index.ts`)
  - **src/shared/**: code shared across processes
  - **src/extensions/**: embedded extensions (statically loaded)
  - **extensions/**: bundled extensions (built separately, shipped with app)
  - **__mocks__/**: mocks for unit tests
  - **__tests__/**: root integration/cross-cutting tests
  - **.vscode/**: VS Code launch/tasks/settings config
  - **dist/**: packaged installer/output artifacts
  - **src/main/out/**: development runtime output (`pnpm run build`)
  - **src/main/dist/**: production staging output (`pnpm run dist` + assets/subprojects)
  - **typings.custom/**: custom TypeScript declaration files

# Configuration files

- `package.json`: root workspace scripts and shared tooling dependencies
- `pnpm-workspace.yaml`: workspace package list and native build settings
- `pnpm-lock.yaml`: workspace lockfile
- `tsconfig.json`: root TypeScript project references
- `.npmrc`: native module build defaults (electron headers/msvs settings)
- `BuildSubprojects.json`: bundled extension build descriptors
- `InstallAssets.json`: static asset copy/build manifest
- `src/main/electron-builder.config.json`: electron-builder packaging config
- `versions.json`: minimum Vortex version accepted for feedback

# Utility scripts

- `bootstrap.ps1`: Windows bootstrap for local development setup
- `updateLicenses.js`: generate third-party modules/licenses list for About page

# Build/install scripts

- `preinstall.js`: builds native prerequisites used by the workspace
- `BuildSubprojects.mjs`: builds/copies bundled extensions into target output dir
- `InstallAssets.mjs`: copies static assets into output directories
- `postinstall.js`: verifies native module build/install state
- `src/main/prepare-dist-package.mjs`: generates staging package metadata for dist packaging

# Common root commands

- `pnpm run build:fomod && pnpm install`: setup dependencies
- `pnpm run build`: development build (`src/main/out`)
- `pnpm run assets:out`: copy/build runtime assets for development
- `pnpm run subprojects:out`: build bundled extensions for development
- `pnpm run dist`: production webpack bundles (`src/main/dist`)
- `pnpm run package` / `pnpm run package:nosign`: produce installer artifacts
