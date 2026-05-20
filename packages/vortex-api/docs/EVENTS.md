# Vortex Events Reference

This document lists all events that extensions can listen to or emit through the Vortex API.

## Event patterns

Vortex uses two event mechanisms:

```ts
// Synchronous events - fire-and-forget
context.api.events.on('event-name', (args) => { ... });
context.api.events.emit('event-name', args);

// Async events - handlers return promises, caller can await all handlers
context.api.onAsync('event-name', async (args) => { ... });
await context.api.emitAndAwait('event-name', args);
```

Register event handlers inside `context.once()` to ensure all extensions are loaded first.

---

## Game mode & profile

| Event                 | Args                  | Description                            |
| --------------------- | --------------------- | -------------------------------------- |
| `gamemode-activated`  | `(gameId: string)`    | User switched to a different game mode |
| `activate-game`       | `(gameId: string)`    | Request to activate a game             |
| `profile-did-change`  | `(profileId: string)` | Profile has been switched              |
| `profile-will-change` | -                     | About to switch profiles               |

## Game discovery

| Event                        | Args                                         | Description                                  |
| ---------------------------- | -------------------------------------------- | -------------------------------------------- |
| `discover-game`              | `(gameId: string)`                           | Async. Discover a specific game installation |
| `discover-tools`             | `(gameId: string)`                           | Async. Discover tools for a game             |
| `start-discovery`            | -                                            | Start full game discovery scan               |
| `start-quick-discovery`      | `(cb?: (gameIds: string[]) => void)`         | Quick discovery of known games               |
| `cancel-discovery`           | -                                            | Cancel ongoing discovery                     |
| `refresh-game-info`          | `(gameId: string, cb: (err: Error) => void)` | Refresh cached info for a game               |
| `manually-set-game-location` | `(gameId: string, cb: (err: Error) => void)` | Manually set game install path               |

## Deployment

| Event                | Args                                                        | Description                            |
| -------------------- | ----------------------------------------------------------- | -------------------------------------- |
| `will-deploy`        | `(profileId: string, deployment?: IDeploymentManifest)`     | Async. Before deployment begins        |
| `did-deploy`         | `(profileId: string, deployment?: IDeploymentManifest)`     | Async. After deployment completes      |
| `will-purge`         | `(profileId: string, lastDeployment?: IDeploymentManifest)` | Async. Before purge (un-deploy) begins |
| `did-purge`          | `(profileId: string)`                                       | Async. After purge completes           |
| `deploy-mods`        | `(profileId: string, cb?, ...)`                             | Request mod deployment                 |
| `deploy-single-mod`  | `(gameId: string, modId: string, ...)`                      | Async. Deploy a single mod             |
| `purge-mods`         | `(allowFallback: boolean, cb: (err: Error) => void)`        | Purge all deployed mods                |
| `purge-mods-in-path` | `(gameId: string, modType: string, modPath: string)`        | Async. Purge mods in a specific path   |
| `await-activation`   | `(cb: (err: Error) => void)`                                | Wait for current deployment to finish  |

## Mod installation

| Event                    | Args                                                    | Description                     |
| ------------------------ | ------------------------------------------------------- | ------------------------------- |
| `will-install-mod`       | `(gameId: string, archiveId: string, modId: string)`    | Async. Before mod installation  |
| `did-install-mod`        | `(gameId: string, archiveId: string, modId: string)`    | After mod is installed          |
| `start-install`          | `(archivePath: string, cb?: (err, id: string) => void)` | Start install from archive path |
| `start-install-download` | `(downloadId: string, ...)`                             | Start install from a download   |
| `create-mod`             | `(gameId: string, mod: IMod, cb: (err: Error) => void)` | Create a new mod entry          |
| `mod-content-changed`    | -                                                       | Mod files on disk changed       |
| `simulate-installer`     | -                                                       | Simulate mod installation       |

## Mod removal

| Event              | Args                                                              | Description                      |
| ------------------ | ----------------------------------------------------------------- | -------------------------------- |
| `will-remove-mod`  | `(gameId: string, modId: string, options?: IRemoveModOptions)`    | Async. Before single mod removal |
| `did-remove-mod`   | `(gameId: string, modId: string, ...)`                            | Async. After single mod removal  |
| `will-remove-mods` | `(gameId: string, modIds: string[], options?: IRemoveModOptions)` | Async. Before batch mod removal  |
| `did-remove-mods`  | `(gameId: string, removedMods: IMod[])`                           | Async. After batch removal       |
| `remove-mod`       | `(gameId: string, modId: string, ...)`                            | Request single mod removal       |
| `remove-mods`      | `(gameId: string, modIds: string[], ...)`                         | Request batch mod removal        |

## Mod state

| Event                           | Args                                 | Description                                   |
| ------------------------------- | ------------------------------------ | --------------------------------------------- |
| `mod-enabled`                   | `(profileId: string, modId: string)` | A mod was enabled in a profile                |
| `mods-enabled`                  | -                                    | One or more mods were enabled                 |
| `did-enable-mods`               | -                                    | Async. Mods were enabled (load order trigger) |
| `recalculate-modtype-conflicts` | -                                    | Recalculate mod type conflicts                |

## Downloads

| Event                     | Args                                                          | Description                                          |
| ------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| `start-download`          | `(urls, modInfo, fileName?, cb?, ...)`                        | Start downloading a file                             |
| `start-download-url`      | `(url: string)`                                               | Start download from a direct URL                     |
| `pause-download`          | `(downloadId, cb?)`                                           | Pause an active download                             |
| `resume-download`         | `(downloadId, cb?, options?)`                                 | Resume a paused download                             |
| `remove-download`         | `(downloadId, cb?, options?: IDownloadRemoveOptions)`         | Remove a download                                    |
| `did-finish-download`     | `(downloadId: string, state: string)`                         | Download completed                                   |
| `import-downloads`        | `([filePath], cb: (dlIds: string[]) => void)`                 | Import downloads from files                          |
| `did-import-downloads`    | `(dlIds: string[], cb?: (err?: Error) => void)`               | Downloads were imported                              |
| `did-move-downloads`      | -                                                             | Downloads folder was moved                           |
| `will-move-downloads`     | -                                                             | Downloads folder is about to move                    |
| `refresh-downloads`       | `(gameId: string, cb: (err) => void)`                         | Refresh download list                                |
| `enable-download-watch`   | `(enabled: boolean)`                                          | Enable/disable download folder watching              |
| `set-download-games`      | `(dlId: string, gameIds: string[], fromMetadata?: boolean)`   | Async. Assign game(s) to a download                  |
| `filehash-calculated`     | `(filePath: string, md5Hash: string, fileSize: number)`       | File hash was computed                               |
| `get-download-free-slots` | `(cb: (freeSlots: number) => void)`                           | Query available download slots                       |
| `start-download-update`   | `(source, modId, fileId?, ...)`                               | Async. Start download update check                   |
| `browse-for-download`     | `(navUrl: string, instructions: string, skippable?: boolean)` | Async. Open browser for download. Returns `string[]` |

## Dependencies

| Event                       | Args                                                                      | Description                          |
| --------------------------- | ------------------------------------------------------------------------- | ------------------------------------ |
| `install-dependencies`      | `(profileId: string, gameId: string, modIds: string[], silent?: boolean)` | Install mod dependencies             |
| `install-recommendations`   | `(profileId: string, gameId: string, modIds: string[])`                   | Install recommended mods             |
| `did-install-dependencies`  | -                                                                         | Dependencies were installed          |
| `install-from-dependencies` | -                                                                         | Async. Install from dependency list  |
| `cancel-dependency-install` | `(modId: string)`                                                         | Async. Cancel dependency install     |
| `reset-dependency-installs` | -                                                                         | Async. Reset all dependency installs |

## Nexus Mods integration

| Event                    | Args                                                                      | Description                          |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------------------ |
| `nexus-download`         | `(siteId, modId, fileId, ...)`                                            | Async. Download mod from Nexus       |
| `endorse-nexus-mod`      | `(siteId: string, modId: string, version: string, endorseStatus: string)` | Async. Endorse a mod                 |
| `check-mods-version`     | `(gameId, modIds?, ...)`                                                  | Async. Check mods for updates        |
| `get-mod-files`          | `(siteId, modId, ...)`                                                    | Async. Get available files for a mod |
| `get-latest-mods`        | -                                                                         | Async. Get latest mods               |
| `get-trending-mods`      | -                                                                         | Async. Get trending mods             |
| `refresh-user-info`      | -                                                                         | Refresh Nexus user info / session    |
| `request-nexus-login`    | `(cb)`                                                                    | Prompt user to log in to Nexus       |
| `did-login`              | `(err: Error)`                                                            | Nexus login completed                |
| `retrieve-category-list` | `(isUpdate: boolean)`                                                     | Fetch category list from Nexus       |
| `update-categories`      | `(gameId, categories, isUpdate)`                                          | Update mod categories                |
| `open-mod-page`          | -                                                                         | Open mod page on Nexus               |
| `mod-update`             | -                                                                         | A mod has an update available        |
| `mods-update`            | -                                                                         | Multiple mods have updates           |
| `submit-feedback`        | -                                                                         | Submit user feedback                 |
| `send-metric`            | -                                                                         | Async. Send metric to Nexus          |

## Collections

| Event                             | Args                               | Description                         |
| --------------------------------- | ---------------------------------- | ----------------------------------- |
| `get-nexus-collection`            | `(collectionId, revisionId?, ...)` | Async. Get a Nexus collection       |
| `get-nexus-collections`           | -                                  | Async. Get multiple collections     |
| `get-my-collections`              | -                                  | Async. Get user's collections       |
| `get-nexus-collection-revision`   | -                                  | Async. Get collection revision      |
| `resolve-collection-url`          | `(collectionUrl: string)`          | Async. Resolve URL to collection ID |
| `rate-nexus-collection-revision`  | -                                  | Async. Rate a collection revision   |
| `will-install-collection`         | -                                  | Async. Before collection install    |
| `did-install-collection`          | -                                  | Collection was installed            |
| `did-download-collection`         | -                                  | Collection was downloaded           |
| `collection-postprocess-complete` | -                                  | Collection post-processing done     |
| `collection-mod-skipped`          | -                                  | A mod in the collection was skipped |
| `submit-collection`               | -                                  | Submit collection to Nexus          |
| `update-conflicts-and-rules`      | -                                  | Async. Update collection conflicts  |

## Extensions

| Event                             | Args                            | Description                              |
| --------------------------------- | ------------------------------- | ---------------------------------------- |
| `install-extension`               | `(ext: IExtensionDownloadInfo)` | Async. Install an extension              |
| `install-extension-from-download` | `(archiveId: string)`           | Async. Install extension from download   |
| `show-extension-page`             | `(modId: number)`               | Show extension manager page              |
| `download-script-extender`        | `(gameId: string)`              | Async. Download script extender for game |

## Settings

| Event              | Args                                                          | Description                         |
| ------------------ | ------------------------------------------------------------- | ----------------------------------- |
| `bake-settings`    | `(gameId: string, mods: IMod[], profile: IProfile)`           | Async. Apply settings to game files |
| `apply-settings`   | `(profile: IProfile, filePath: string, parser: IniFile<any>)` | Async. Apply INI/config settings    |
| `settings-changed` | `(path: string[])`                                            | Application settings changed        |

## UI & navigation

| Event                 | Args                                                              | Description                   |
| --------------------- | ----------------------------------------------------------------- | ----------------------------- |
| `show-main-page`      | `(pageId: string)`                                                | Navigate to a main page       |
| `refresh-main-page`   | -                                                                 | Refresh current main page     |
| `open-knowledge-base` | `(articleId: string)`                                             | Open a knowledge base article |
| `hide-modal`          | `(modal: string)`                                                 | Hide a modal dialog           |
| `preview-files`       | `(files: IPreviewFile[], cb?: (selection: IPreviewFile) => void)` | Show file preview dialog      |
| `quick-launch`        | -                                                                 | Quick launch game/tool        |

## Analytics

| Event                         | Args                                                                 | Description           |
| ----------------------------- | -------------------------------------------------------------------- | --------------------- |
| `analytics-track-event`       | `(category: string, action: string, label?: string, value?: number)` | Track analytics event |
| `analytics-track-click-event` | `(page: string, element: string)`                                    | Track UI click        |

## Miscellaneous

| Event              | Args                                  | Description                  |
| ------------------ | ------------------------------------- | ---------------------------- |
| `startup`          | -                                     | Application startup complete |
| `report-feedback`  | `(errorMessage: string)`              | Report feedback/error        |
| `trigger-test-run` | `(eventType: string, delay?: number)` | Trigger test runner          |
