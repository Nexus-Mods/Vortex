# Stardew Valley Extension Architecture

This extension adds Stardew Valley support to Vortex.

The codebase is organised so that `index.ts` is only responsible for wiring
modules together, while feature logic lives in dedicated files/folders.

## Quick orientation

- If you are new to Vortex extension APIs, start with `index.ts`.
- If you need to change install behaviour, start in `installers/`.
- If you need to change runtime event behaviour, start in `runtime/`.
- If you need to change UI behaviour, start in `registration/registerUi.ts` and
  `Settings.tsx`.

## Structure map

- `index.ts`
  - Composition root for this extension.
  - Registers game metadata, installers, mod types, UI, tests, attribute
    extractors, and runtime event handlers.

- `game/StardewValleyGame.ts`
  - Class: `StardewValleyGame` (`types.IGame` implementation).
  - Owns game discovery, executable info, mod path, and setup flow.

- `installers/`
  - `rootFolderInstaller.ts`
    - Functions: `testRootFolder`, `installRootFolder`.
    - Installs to the game root. Automatically selected when a mod archive
      contains a top-level `Content/` folder.
  - `smapiInstaller.ts`
    - Functions: `testSMAPI`, `installSMAPI`, `isSMAPIModType`.
    - Handles SMAPI package extraction and SMAPI mod-type matching.
  - `stardewValleyInstaller.ts`
    - Functions: `testSupported`, `installStardewValley`.
    - Handles manifest-based Stardew mod archives.

- `registration/`
  - `registerInstallers.ts`
    - Registers installer matchers/installers with Vortex.
  - `registerModTypes.ts`
    - Registers `SMAPI`, `sdv-configuration-mod`, and `sdvrootfolder` mod
      types.
  - `registerUi.ts`
    - Registers settings panel, SMAPI log action, and compatibility table
      column.
  - `registerTests.ts`
    - Registers extension tests (`sdv-incompatible-mods`).

- `runtime/registerRuntimeEvents.ts`
  - Registers runtime event handlers (`did-deploy`, `did-purge`,
    `did-install-mod`, `gamemode-activated`, etc.).

- `ui/smapiLog.ts`
  - Functions: `onShowSMAPILog` (and internal dialog helper).
  - Handles reading, displaying, and sharing SMAPI logs.

- `compatibility/updateConflictInfo.ts`
  - Function: `updateConflictInfo`.
  - Queries SMAPI compatibility metadata and updates mod attributes.

- `manifests/`
  - `getModManifests.ts`
    - Function: `getModManifests`.
    - Finds all `manifest.json` files in a mod path.
  - `createManifestAttributeExtractor.ts`
    - Factory: `createManifestAttributeExtractor`.
    - Builds Vortex attribute extractor for manifest-derived metadata.

- `modtypes/sdvRootFolderMatcher.ts`
  - Function: `isSdvRootFolderModType`.
  - Detects root-level installs by checking for copy instructions targeting
    `Content/`, so `sdvrootfolder` is assigned automatically.

- `helpers.ts`
  - Shared helpers: `toBlue` and `errorMessage`.
  - Keeps cross-cutting utility behaviour consistent.

- `configMod.ts`
  - Owns SDV configuration-file merge/sync workflow.
  - Handles config mod creation, file imports, and revert behaviour.

- `SMAPI.ts`
  - SMAPI install/deploy/update helper flows and SMAPI mod/tool discovery.

- `smapiProxy.ts`
  - Class: `SMAPIProxy`.
  - Adapter for SMAPI.io metadata API lookups and Nexus fallback.

- `DependencyManager.ts`
  - Class: `DependencyManager`.
  - Scans active mods and caches parsed manifests for dependency tests.

- `actions.ts`
  - SDV-specific Redux actions.

- `reducers.ts`
  - SDV settings reducer (`settings.SDV`).

## State and data touchpoints

- Reads from:
  - `settings.gameMode.discovered.stardewvalley`
  - `persistent.mods.stardewvalley`
  - `settings.SDV`
- Writes to:
  - `settings.SDV.useRecommendations`
  - `settings.SDV.mergeConfigs`
  - mod attributes like compatibility fields and config-mod metadata
