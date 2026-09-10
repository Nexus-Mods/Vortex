# Extensions

What an extension is in Vortex, how the three kinds get loaded, and what the
registration surface looks like. For someone who has read
[repo-layout.md](repo-layout.md) and wants the model rather than the file list.
For games specifically, and for how extensions are published and picked up, see
[game-support.md](game-support.md).

Almost all of Vortex is extensions. Mod management, collections, the FOMOD
installers, download management and the Nexus integration are all extensions, so
this is not a plugin system bolted onto an application. It is how the
application is assembled.

## An extension is a directory with two files

The load contract is small: a directory containing an entry point named
`index.cjs` or `index.js`, and an `info.json` beside it that parses.
`src/renderer/src/ExtensionManager.ts` gives up on a directory that is missing
either. No `main` field is honoured.

The entry point's default export is an init function,
`(context: IExtensionContext) => boolean`. A bare function export works too;
`getExtensionInitFunc` handles the `__esModule` interop. `info.json` carries
`name`, `version` and `author`, optionally `id` and `namespace`, and is parsed by
`parseExtensionInfo` in
`src/renderer/src/extensions/extension_manager/extensionInfo.ts`.

Translation extensions are the exception: they have no entry point, so a
directory with no `index.js` is logged at debug level and skipped rather than
treated as broken.

## Three kinds, three ways of loading

`prepareExtensions()` in `ExtensionManager.ts` assembles all of them.

**Static, or core.** An explicit hardcoded map from name to `require()` call,
45 entries covering everything in `src/renderer/src/extensions/`. These
are compiled into the renderer bundle and marked `dynamic: false`.
`src/renderer/src/extensions/index.ts` is _not_ the registry; its `import {}`
statements exist only so `tsc` recompiles on change and are removed at build
time.

**Order in that map matters.** It is the load order, and there is a real
dependency encoded in it: `gameversion_management` is listed before
`gamemode_management` so that `GameVersionManager` exists by the time
`gamemode_management`'s `once` calls `setupGameMode`. If you add a core
extension, think about where in the map it goes.

**Bundled.** Rescanned from disk on every boot, from
`getVortexPath("bundledPlugins")`, and never persisted. This is where
`extensions/` and `extensions/games/` end up after packaging. Loaded with
`bundled: true`.

**User.** Extensions the user installed, loaded from persisted state and then
reconciled against disk. This is the Extensions page's territory, and the path
that game extensions, themes and translations arrive by. See
[game-support.md](game-support.md) for publishing and pickup.

Bundled and user extensions are both "dynamic": loaded with a real `require` at
runtime rather than bundled into the renderer, which is why they need an app
relaunch rather than a hot reload.

## Lifecycle

1. **`init(context)`** runs for every extension. This is registration time and
   nothing else. Call the `register*` methods you need and return.
2. **`once()`** callbacks run after the store is set up and every extension has
   been initialised.

The rule that catches people: **you cannot assume anything about the order
extensions load in, or that they load synchronously.** If your extension needs
another one to have finished initialising, check for that inside your `once`
callback and react to a state change, rather than assuming it already happened.
The one exception is the static map above, where order is fixed because it is
written down.

`requireVersion(range)` declares a Vortex version range, and
`requireExtension(extId, version?, optional?)` declares a dependency on another
extension.

`onceMain()` runs on the Electron main process and is **deprecated**. It will be
removed. If you need an unrestricted Node environment, use a separate Node
process and talk to it over IPC, and tell the Vortex team what you are trying to
do first.

## What needs a relaunch

[CONTRIBUTING.md](../CONTRIBUTING.md) covers this for day-to-day work. In short,
edits that cannot be hot-applied include reducers, utils and an extension's
`index.ts` init code, and the dynamic extensions in `extensions/` and
`extensions/games/` need a full app relaunch rather than a `pnpm run dev`
restart.

## The registration surface

`IExtensionContext` in `src/renderer/src/types/IExtensionContext.ts` declares 44
`register*` methods. They are all documented inline; the point of this table is
to tell you which corner to go and read.

| Area                   | Methods                                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Game support           | `registerGame`, `registerGameStub`, `registerGameStore`, `registerGameInfoProvider`, `registerGameVersionProvider`, `registerGameSpecificCollectionsData`, `registerToolVariables`                                                                                                         |
| Mod install and deploy | `registerInstaller`, `registerModType`, `registerDeploymentMethod`, `registerMerge`, `registerArchiveType`, `registerModSource`, `registerRepositoryLookup`, `registerAttributeExtractor`                                                                                                  |
| Load order             | `registerLoadOrder`, `registerLoadOrderPage`                                                                                                                                                                                                                                               |
| UI surfaces            | `registerMainPage`, `registerDashlet`, `registerSettings`, `registerAction`, `registerActionCheck`, `registerBanner`, `registerFooter`, `registerOverlay`, `registerDialog`, `registerToDo`, `registerTableAttribute`, `registerControlWrapper`, `registerPreview`, `registerHistoryStack` |
| State                  | `registerReducer`, `registerSettingsHive`, `registerPersistor`, `registerMigration`, `registerProfileFeature`, `registerProfileFile`                                                                                                                                                       |
| Diagnostics            | `registerTest`, `registerHealthCheck`                                                                                                                                                                                                                                                      |
| API and integration    | `registerAPI`, `registerProtocol`, `registerDownloadProtocol`, `registerInterpreter`, `registerStartHook`                                                                                                                                                                                  |

For the published API surface an external author writes against, read
`etc/vortex.api.md`. It is generated by `pnpm run api`, so no hand-written
summary of it belongs in this doc. It is only as current as the last person to
regenerate it, though, so if something in it looks wrong against the source,
regenerate before believing it.

## Extension types

`ExtensionType` in `src/renderer/src/types/extensions.ts` is `game`,
`translation` or `theme`. The same three appear in the
`GET /v3/vortex/extensions` response that the Extensions page reads.

Several fields on `ExtensionInfo` are marked deprecated and are no longer read
from `info.json`, including `bundled`, `type`, `modId` and `fileId`. `bundled` in
particular is computed at load time from which of the three paths above the
extension came in by, so do not put it in an `info.json` and expect it to mean
anything.

## Worth reading as reference

- `src/renderer/src/extensions/mod_management/` for a large core extension
- `extensions/games/game-palworld/src/index.js` for the smallest useful one, a
  game stub in twenty lines
- `extensions/gamebryo-plugin-management/` for a substantial bundled extension

## Key Files

| Path                                             | Purpose                                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `src/renderer/src/ExtensionManager.ts`           | Finds, loads and initialises everything. `prepareExtensions` is the entry point worth reading first |
| `src/renderer/src/types/IExtensionContext.ts`    | `IExtensionContext`, the 44 `register*` methods, `once`, `requireExtension`                         |
| `src/renderer/src/types/extensions.ts`           | `ExtensionInfo`, `ExtensionInit`, `ExtensionType`                                                   |
| `src/renderer/src/extensions/extension_manager/` | The Extensions page: listing, install, state                                                        |
| `etc/vortex.api.md`                              | Generated report of the published `vortex-api` surface                                              |
| `packages/vortex-api/`                           | The extension-facing API package published to npm                                                   |

## Related

- [game-support.md](game-support.md) for games, and for publishing and pickup
- [repo-layout.md](repo-layout.md) for where things live
- [../RELEASES.md](../RELEASES.md) for `vortex-api` deprecation windows
- [investigation/vscode.md](investigation/vscode.md) and
  [investigation/obsidian.md](investigation/obsidian.md) for how other products
  solve this, kept as prior art rather than as descriptions of Vortex
