# Repository Layout

Where everything lives, and which directory to start in for a given kind of
change.

## Core app

- `src/main/src/` - Electron main process: app startup, windows, IPC, downloads,
  telemetry, extension loading
- `src/renderer/src/` - React renderer: `views/`, `controls/`, `actions/`,
  `reducers/`, `store/`, `util/`, `extensions/`
- `src/shared/src/` - Shared APIs, types, telemetry, cross-process utilities
- `src/preload/src/` - Electron preload bridge
- `src/queries/` - Database and query setup: `select/`, `setup/`
- `src/stylesheets/` - Shared stylesheets and Tailwind/Sass inputs

## Extensions

Extensions live in two places, and which one you want depends on whether the
feature ships as part of the renderer or as a separately bundled extension.

- `src/renderer/src/extensions/` - Core features implemented as renderer
  extensions. This is where `mod_management` (including `InstallManager`),
  `collections`, and the `installer_fomod_*` family live.
- `extensions/` - Bundled feature extensions, loaded at runtime
- `extensions/games/` - Game-specific extensions, one folder per game (`game-*`)

Examples worth reading as reference:

- `src/renderer/src/extensions/mod_management/` - Installation, deployment,
  phased collection installs
- `src/renderer/src/extensions/collections/` - Collections support
- `extensions/mod-dependency-manager/` - Mod dependency handling
- `extensions/gamebryo-plugin-management/` - Bethesda plugin management

## Packages

Workspace packages under `packages/` (plus `packages/adaptors/*`, which is its
own workspace glob):

- `packages/vortex-api/` - The extension-facing API package published to NPM
- `packages/adaptor-api/` - Interfaces and builder for game adaptors
- `packages/adaptors/` - Individual adaptors, one directory each
  (`cyberpunk2077`, plus `fs-test` and `ping-test` fixtures)
- `packages/nexus-api-v3/` - Typed HTTP client for the Nexus Mods OpenAPI v3 API
- `packages/file-dependency-resolver/` - File-to-file dependency resolver behind
  the file-level requirements health check
- `packages/exe-version/` - Reads version info out of Windows executables
- `packages/pe-resources/` - Portable Executable resource parsing
- `packages/icon-extract/` - Extracts icons from executables
- `packages/extension-test-mocks/` - Shared mocks for extension tests
- `packages/game-extension-test/` - Harness and CLI for testing game extensions
- `packages/e2e/` - Playwright end-to-end tests

## Supporting areas

- `docs/` - Project and coding documentation; start at [README.md](README.md)
- `scripts/` - Workspace, build and automation scripts
- `tools/` - One-off utilities and build helpers
- `assets/` - Static bundled assets
- `locales/` - Translations
- `eslint-rules/` - Custom ESLint rules
- `flatpak/` - Flatpak manifest and build scripts
- `etc/` - Generated API report (`vortex.api.md`) and dependency report

## Start here

| Working on                     | Start in                                                     |
| ------------------------------ | ------------------------------------------------------------ |
| UI or component work           | `src/renderer/src/views/`, `src/renderer/src/ui/components/` |
| Renderer state                 | `src/renderer/src/actions/`, `reducers/`, `store/`           |
| Main-process behavior          | `src/main/src/`                                              |
| IPC wiring                     | `src/main/src/ipc*.ts`, `src/shared/src/api/`                |
| Shared types or utilities      | `src/shared/src/`                                            |
| Install or deployment behavior | `src/renderer/src/extensions/mod_management/`                |
| Collections                    | `src/renderer/src/extensions/collections/`                   |
| Bundled feature behavior       | `extensions/`                                                |
| Game-specific behavior         | `extensions/games/`                                          |
| Extension API changes          | `packages/vortex-api/`                                       |

## Usually ignore

Generated or vendored, and not worth searching:

- `src/main/build/`, `src/main/dist/`, `src/renderer/lib/` - Build output. These are packaging
  output and input; see [packaging/windows.md](packaging/windows.md) when
  working on installers.
- `test-results/` - Test artifacts
- `node_modules/` - Dependencies
