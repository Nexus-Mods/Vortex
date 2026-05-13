# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-05-12

### Changed

- Large state changes (mass plugin sort, collection install, bulk rule edits) no longer stall Vortex ([#23049](https://github.com/Nexus-Mods/Vortex/pull/23049))
- Theme cloning is blocked while the source theme has validation issues ([#23068](https://github.com/Nexus-Mods/Vortex/pull/23068))
- Reduced crash-report noise: better grouping, and user-environment errors (permission denied, disk full, read-only drive) and user-cancelled actions are no longer reported as crashes ([#23050](https://github.com/Nexus-Mods/Vortex/pull/23050), [#23059](https://github.com/Nexus-Mods/Vortex/pull/23059), [#23066](https://github.com/Nexus-Mods/Vortex/pull/23066))
- More detail captured when a Nexus API request fails ([#23101](https://github.com/Nexus-Mods/Vortex/pull/23101))

### Fixed

- "Deployment interrupted" failure when symlink deployment required elevation ([#23107](https://github.com/Nexus-Mods/Vortex/pull/23107))
- nxm:// links not being captured by Vortex after 2.0.0 ([#23107](https://github.com/Nexus-Mods/Vortex/pull/23107))
- State verifier looping on the same entries, so repair warnings reappeared on every launch ([#23112](https://github.com/Nexus-Mods/Vortex/pull/23112))
- "NXM handler registered" notification appearing on every startup ([#23026](https://github.com/Nexus-Mods/Vortex/pull/23026))
- Baldur's Gate 3 "pak read failed" error spam on load-order changes ([#23022](https://github.com/Nexus-Mods/Vortex/pull/23022))
- Renderer bootloop after an outdated extension was queued for removal ([#23048](https://github.com/Nexus-Mods/Vortex/pull/23048))
- Stardew Valley hardlink deployment failing with a self-copy error ([#23055](https://github.com/Nexus-Mods/Vortex/pull/23055))
- Crash while loading extensions when a stale install or backup folder was present ([#23063](https://github.com/Nexus-Mods/Vortex/pull/23063))
- Collection plugin-rules toggles shown for games without plugins ([#23018](https://github.com/Nexus-Mods/Vortex/pull/23018))
- Awkward line breaks in game-name tooltips in the new UI ([#23019](https://github.com/Nexus-Mods/Vortex/pull/23019))

## [2.0.0] - 2026-05-06

_Stable 2.0 release. See the alpha and beta entries below for the full list of changes since 1.16._

### Changed

- GraphQL error path, locations, and query now surfaced in Nexus API warning logs for easier diagnosis ([#22886](https://github.com/Nexus-Mods/Vortex/pull/22886))

### Fixed

- Restored ability to import a single nested folder by dropping it onto the mods page (with confirmation prompt) ([#22866](https://github.com/Nexus-Mods/Vortex/pull/22866))
- Updater notification never dismissing after the download was kicked off in the background ([#22826](https://github.com/Nexus-Mods/Vortex/pull/22826))
- Health check "Open mod page" crash and improved Nexus URL fallback ([#22812](https://github.com/Nexus-Mods/Vortex/pull/22812))
- Variant name accepting filesystem-illegal characters, breaking staging folder creation ([#22827](https://github.com/Nexus-Mods/Vortex/pull/22827))
- Non-actionable mod-requirements failure shown as a user-facing toast ([#22841](https://github.com/Nexus-Mods/Vortex/pull/22841))
- Spurious "external changes" dialog after replacing or removing a mod; removed mods' manifest entries now auto-resolve on the next deploy ([#22854](https://github.com/Nexus-Mods/Vortex/pull/22854))
- File description shown by the UAC elevation dialog (backport from master that had not reached v2.0) ([#22858](https://github.com/Nexus-Mods/Vortex/pull/22858))
- `react-hot-toast` render crash now contained by an error boundary; toast system disables itself on persistent failure instead of crashing the renderer ([#22884](https://github.com/Nexus-Mods/Vortex/pull/22884))

## [2.0.0-beta.2] - 2026-04-27

### Added

- Per-profile plugin rules with "Reset Plugin Rules" button and curator/consumer controls to skip or exclude plugin rules when installing collections ([#22620](https://github.com/Nexus-Mods/Vortex/pull/22620))

### Changed

- BG3: refactored divine wrapper with cleaner error classification, cancellation on game switch, and silent skipping of corrupt third-party paks instead of "re-install LSLib" notifications ([#22679](https://github.com/Nexus-Mods/Vortex/pull/22679))

### Fixed

- Install crash from `fileList.push` spread overflowing the call stack on archives with ~100k+ files ([#22704](https://github.com/Nexus-Mods/Vortex/pull/22704))
- FOMOD `KeyNotFoundException` when saved preset choices referenced steps that no longer exist ([#22706](https://github.com/Nexus-Mods/Vortex/pull/22706))
- FOMOD installer rejecting saved presets when "no options" fell back to an empty object instead of an empty array ([#22716](https://github.com/Nexus-Mods/Vortex/pull/22716))
- "Vortex seems to be running already" dialog incorrectly shown for non-ASCII path, permission, or disk-full errors instead of real DB lock contention ([#22703](https://github.com/Nexus-Mods/Vortex/pull/22703))
- Mod install crash with undefined `gameId` when the current profile was stale or absent ([#22684](https://github.com/Nexus-Mods/Vortex/pull/22684))
- Witcher 3 Script Merger dummy installer crash and misleading error notifications when installing the script merger archive as a mod ([#22677](https://github.com/Nexus-Mods/Vortex/pull/22677))
- Missing extension identity in failed-init error payload making startup crash reports untraceable ([#22672](https://github.com/Nexus-Mods/Vortex/pull/22672))
- Notifications render crash caused by `quickUpdate` stale-index writes ([#22643](https://github.com/Nexus-Mods/Vortex/pull/22643))
- Notifications reducer and `quickUpdate` crashing on malformed payloads ([#22816](https://github.com/Nexus-Mods/Vortex/pull/22816))
- File UID generation failing due to stale Nexus games cache ([#22641](https://github.com/Nexus-Mods/Vortex/pull/22641))
- Several race conditions when switching collection revisions: patched mods not reinstalled, install driver starting before old mods were cleaned up, optional mods losing enabled state, update notification shown on latest revision, and install activity running indefinitely ([#22520](https://github.com/Nexus-Mods/Vortex/pull/22520))
- Crash when downloading collection mods while the collection was being reinstalled or updated ([#22607](https://github.com/Nexus-Mods/Vortex/pull/22607))
- Auto-download not triggering for patch updates in the auto-updater ([#22609](https://github.com/Nexus-Mods/Vortex/pull/22609))
- Spurious error notification when the user declined the Nexus login consent prompt ([#22715](https://github.com/Nexus-Mods/Vortex/pull/22715))
- Spurious error notification for discarded collection revisions and collections under moderation ([#22717](https://github.com/Nexus-Mods/Vortex/pull/22717))
- Failed Gamebryo plugin light-flag changes (eslify) recorded as successful history entries ([#22803](https://github.com/Nexus-Mods/Vortex/pull/22803))
- Morrowind plugin scan aborting the whole loop when a single mod's install directory was missing or inaccessible ([#22714](https://github.com/Nexus-Mods/Vortex/pull/22714))

## [2.0.0-beta.1] - 2026-04-14

_First beta of the 2.0 release. See the alpha release notes below for a full list of changes since 1.16._

### Added

- Support for blueprint plugins in Starfield's load order ([#22400](https://github.com/Nexus-Mods/Vortex/pull/22400))

### Changed

- Updated Starfield native plugins list for new DLCs ([#22400](https://github.com/Nexus-Mods/Vortex/pull/22400))
- Updated libloot to 0.29.3 ([#22400](https://github.com/Nexus-Mods/Vortex/pull/22400))

### Fixed

- Dropdown buttons not responding to click after row focus steal ([#22413](https://github.com/Nexus-Mods/Vortex/pull/22413))
- Collection edit incorrectly warning collaborators who have edit permissions ([#22405](https://github.com/Nexus-Mods/Vortex/pull/22405))
- Plugin management switch requiring app restart when toggling between rules-based and drag-and-drop ([#22400](https://github.com/Nexus-Mods/Vortex/pull/22400))
- Active profile deletion not handled correctly ([#22426](https://github.com/Nexus-Mods/Vortex/pull/22426))
- Minimize and maximize not working correctly ([#22425](https://github.com/Nexus-Mods/Vortex/pull/22425))
- Healthcheck settings button not always opening global settings ([#22332](https://github.com/Nexus-Mods/Vortex/pull/22332))
- Wrong 7z binary used for Linux environment ([#22319](https://github.com/Nexus-Mods/Vortex/pull/22319))

## [2.0.0-alpha.4] - 2026-04-09

### Added

- Ability to preserve FOMOD presets when installing variants ([#22320](https://github.com/Nexus-Mods/Vortex/pull/22320))

### Changed

- Updated 7zip binaries to 26.00 ([#22284](https://github.com/Nexus-Mods/Vortex/pull/22284))
- Updated onboarding videos ([#22316](https://github.com/Nexus-Mods/Vortex/pull/22316))

### Fixed

- FOMOD UI cancelling installation on backdrop click ([#22278](https://github.com/Nexus-Mods/Vortex/pull/22278))
- Renderer process not waited on before app relaunch ([#22274](https://github.com/Nexus-Mods/Vortex/pull/22274))
- Manual FOMOD reinstall now shows dialog with preselected values ([#22250](https://github.com/Nexus-Mods/Vortex/pull/22250))
- Crash when sorting an empty mod list ([#22247](https://github.com/Nexus-Mods/Vortex/pull/22247))
- Restore state from backup workaround not functioning ([#22248](https://github.com/Nexus-Mods/Vortex/pull/22248))
- Several issues with staging/game folder recovery after tampering ([#22246](https://github.com/Nexus-Mods/Vortex/pull/22246))
- Missing defensive code when fetching mod info from API ([#22243](https://github.com/Nexus-Mods/Vortex/pull/22243))
- Stack overflow when resolving long synchronous promise chains ([#22237](https://github.com/Nexus-Mods/Vortex/pull/22237))
- Collection mods not considered when checking if requirements are installed ([#22127](https://github.com/Nexus-Mods/Vortex/pull/22127))
- UI blocker/dimmer not cleared on successful OAuth login ([#22129](https://github.com/Nexus-Mods/Vortex/pull/22129))
- Profile pages not respecting "Enable Profile Management" toggle in new UI ([#22131](https://github.com/Nexus-Mods/Vortex/pull/22131))
- Startup crash when dialogs shown before main window exists ([#22121](https://github.com/Nexus-Mods/Vortex/pull/22121))
- Remaining instances of `app.quit` causing application crash ([#22095](https://github.com/Nexus-Mods/Vortex/pull/22095))
- Missing peer dependencies for modmeta-db ([#22093](https://github.com/Nexus-Mods/Vortex/pull/22093))
- Workaround for Electron >=39.6.1 crash on BrowserView close ([#22086](https://github.com/Nexus-Mods/Vortex/pull/22086))

## [2.0.0-alpha.3] - 2026-03-31

### Added

- Replaced LevelDB with DuckDB as persistence backend ([#20402](https://github.com/Nexus-Mods/Vortex/pull/20402))
- Type-safe path system with resolver pipeline ([#21839](https://github.com/Nexus-Mods/Vortex/pull/21839))
- Ability to filter mods by version ([#21835](https://github.com/Nexus-Mods/Vortex/pull/21835))
- Collection column sorting and grouping ([#21802](https://github.com/Nexus-Mods/Vortex/pull/21802))
- Handling for `direct_download_enabled` flag ([#19233](https://github.com/Nexus-Mods/Vortex/pull/19233))
- Playwright end-to-end test infrastructure ([#21810](https://github.com/Nexus-Mods/Vortex/pull/21810))
- Login status check on browse collections page ([#21831](https://github.com/Nexus-Mods/Vortex/pull/21831))

### Changed

- FOMOD installer is now sourced from NPM ([#21904](https://github.com/Nexus-Mods/Vortex/pull/21904))
- Updated libloot to 0.29.1 ([#21718](https://github.com/Nexus-Mods/Vortex/pull/21718))
- Game settings improvements ([#21716](https://github.com/Nexus-Mods/Vortex/pull/21716))
- Spine and Menu UI improvements ([#21833](https://github.com/Nexus-Mods/Vortex/pull/21833))
- Updated game button hover state ([#21868](https://github.com/Nexus-Mods/Vortex/pull/21868))
- Mod settings are now game-specific in new UI ([#21840](https://github.com/Nexus-Mods/Vortex/pull/21840))
- Cleaned up Stardew Valley support and added Linux SMAPI installation support ([#21673](https://github.com/Nexus-Mods/Vortex/pull/21673))
- Improved Script Extender filtering to resolve by game store ([#21866](https://github.com/Nexus-Mods/Vortex/pull/21866))
- Improved unresolved conflicts dialog with de-duplication and better persistence for local changes ([#21871](https://github.com/Nexus-Mods/Vortex/pull/21871))
- Generated vortex-api dts rollup file ([#21703](https://github.com/Nexus-Mods/Vortex/pull/21703))
- Enforced minimum 3 characters when creating new profiles ([#21867](https://github.com/Nexus-Mods/Vortex/pull/21867))

### Fixed

- ECD raised intermittently when updating/reinstalling mods ([#21863](https://github.com/Nexus-Mods/Vortex/pull/21863))
- Race condition causing lslib to attempt installation twice in quick succession ([#21929](https://github.com/Nexus-Mods/Vortex/pull/21929))
- Silent notifications opening tray and inflating badge count ([#21930](https://github.com/Nexus-Mods/Vortex/pull/21930))
- Inability to switch back from shared to per-user mod staging ([#21933](https://github.com/Nexus-Mods/Vortex/pull/21933))
- State sanitization repairs not persisted to disk ([#21936](https://github.com/Nexus-Mods/Vortex/pull/21936))
- Drag-drop support for non-archives on mods page not working ([#21932](https://github.com/Nexus-Mods/Vortex/pull/21932))
- Data not persisting due to UPDATE...RETURNING existence check omitting INSERT ([#21888](https://github.com/Nexus-Mods/Vortex/pull/21888))
- `getVortexPath("temp")` cached to Electron temp path ([#21902](https://github.com/Nexus-Mods/Vortex/pull/21902))
- Installer choices not preserved as expected ([#21869](https://github.com/Nexus-Mods/Vortex/pull/21869))
- Deployment methods modal rendering issue on subsequent clicks ([#21841](https://github.com/Nexus-Mods/Vortex/pull/21841))
- Stall timer not cleared on download cancellation ([#21836](https://github.com/Nexus-Mods/Vortex/pull/21836))
- App metadata initialization issues and CLI args not persisting ([#21712](https://github.com/Nexus-Mods/Vortex/pull/21712))
- Profile page issues in new UI ([#21830](https://github.com/Nexus-Mods/Vortex/pull/21830))
- `onReset` page callback not called in new UI ([#21834](https://github.com/Nexus-Mods/Vortex/pull/21834))
- Premium badge shown on "Install in app" button when user is premium ([#21832](https://github.com/Nexus-Mods/Vortex/pull/21832))
- Dashboard/packery overlap issue ([#21827](https://github.com/Nexus-Mods/Vortex/pull/21827))
- "Help centre" button not working ([#21829](https://github.com/Nexus-Mods/Vortex/pull/21829))
- Default/user-created theme mismatch ([#21713](https://github.com/Nexus-Mods/Vortex/pull/21713))
- Workshop collections incorrectly tagged as "published" ([#21859](https://github.com/Nexus-Mods/Vortex/pull/21859))
- Several issues with category management UI elements ([#21860](https://github.com/Nexus-Mods/Vortex/pull/21860))
- Settings tabs sort order ([#21862](https://github.com/Nexus-Mods/Vortex/pull/21862))
- Wiki link for creating a game extension ([#21934](https://github.com/Nexus-Mods/Vortex/pull/21934))

## [2.0.0-alpha.2] - 2026-03-19

_Internal alpha release for testing — not for public distribution._

### Added

- Progress bar for activity-type notifications ([#21612](https://github.com/Nexus-Mods/Vortex/pull/21612))
- Timeout to permission elevation attempts when writing files ([#21670](https://github.com/Nexus-Mods/Vortex/pull/21670))

### Changed

- Downloads moved to separate page in new UI ([#21704](https://github.com/Nexus-Mods/Vortex/pull/21704))
- Switched to Thumbnail API for image display ([#21684](https://github.com/Nexus-Mods/Vortex/pull/21684))
- Extensions now support loading index.cjs files ([#21669](https://github.com/Nexus-Mods/Vortex/pull/21669))
- Improved plugin count display ([#20990](https://github.com/Nexus-Mods/Vortex/pull/20990))
- Exposed LOOT's isEmpty property for dummy plugins ([#20972](https://github.com/Nexus-Mods/Vortex/pull/20972))
- "Discover more collections" now navigates to Browse NexusMods page ([#21618](https://github.com/Nexus-Mods/Vortex/pull/21618))
- Updated page display order in UI ([#21666](https://github.com/Nexus-Mods/Vortex/pull/21666))
- Added restrictions to healthcheck extension ([#21580](https://github.com/Nexus-Mods/Vortex/pull/21580))
- Plugin rules editor improvements ([#21695](https://github.com/Nexus-Mods/Vortex/pull/21695))
- Cleanup for Pillars of Eternity 2 game extension ([#21547](https://github.com/Nexus-Mods/Vortex/pull/21547))

### Fixed

- State corruption issues causing Vortex to crash and failing to recover on restart ([#21677](https://github.com/Nexus-Mods/Vortex/pull/21677))
- Native frame values not being read correctly from state ([#21698](https://github.com/Nexus-Mods/Vortex/pull/21698))
- Stale discovery data when setting game location manually ([#21675](https://github.com/Nexus-Mods/Vortex/pull/21675))
- Removing active profile not switching user to dashboard ([#21697](https://github.com/Nexus-Mods/Vortex/pull/21697))
- Profile switch to undefined when clicking "Home" button in new UI ([#21665](https://github.com/Nexus-Mods/Vortex/pull/21665))
- Crash from unhandled findByAppId calls in community extensions ([#21661](https://github.com/Nexus-Mods/Vortex/pull/21661))
- Overlay not minimizing correctly ([#21608](https://github.com/Nexus-Mods/Vortex/pull/21608))
- Packery layout issues on dashboard ([#21614](https://github.com/Nexus-Mods/Vortex/pull/21614))
- Profile shortcut creation not working in development environment ([#21607](https://github.com/Nexus-Mods/Vortex/pull/21607))
- Theme switcher issues ([#20824](https://github.com/Nexus-Mods/Vortex/pull/20824))
- Tools section display problems ([#21634](https://github.com/Nexus-Mods/Vortex/pull/21634))
- Spine UI component issues ([#21633](https://github.com/Nexus-Mods/Vortex/pull/21633))
- Notification rendering issues ([#21636](https://github.com/Nexus-Mods/Vortex/pull/21636))
- "Did the Collection work for you" notification dismiss behavior ([#21629](https://github.com/Nexus-Mods/Vortex/pull/21629))
- Removed stroke border visual artifact ([#21620](https://github.com/Nexus-Mods/Vortex/pull/21620))
- Premium badge shown in title bar while logged out ([#21585](https://github.com/Nexus-Mods/Vortex/pull/21585))

## [2.0.0-alpha.1](https://github.com/Nexus-Mods/Vortex/releases/tag/2.0.0-alpha.1) - 2026-03-16

_Internal alpha release for testing — not for public distribution._

### Added

- New Healthcheck feature which notifies you of common issues in your mod setup, such as missing dependencies, and suggests fixes to keep your modded game stable and functioning properly.
- New UI with 1-click game switching and cleaner visual style. Added a toggle in Settings to revert to the legacy UI.
- Design system restructure with component demos and documentation ([#20669](https://github.com/Nexus-Mods/Vortex/pull/20669))
- Vortex API package is now synced and tagged for every Vortex release. See [Nexus-Mods/vortex-api](https://github.com/Nexus-Mods/vortex-api/) for more information.
- Better crash and error reporting

### Changed

- Upgraded from Electron 37.4.0 to Electron 39.8.0 (Node.js 22)
- **[BREAKING]** Internal project structure has changed drastically. Extensions with deep path imports instead of API imports will break. See [Nexus-Mods/vortex-api](https://github.com/Nexus-Mods/vortex-api/) for more information.
- Changed default installation path

### Fixed

- Permission elevation fixes ([#20547](https://github.com/Nexus-Mods/Vortex/pull/20547))
- Process cancellation error handling ([#20549](https://github.com/Nexus-Mods/Vortex/pull/20549))
- Plugin list renderer crash prevention ([#20522](https://github.com/Nexus-Mods/Vortex/pull/20522))
- Collection extension disabled crash prevention ([#20637](https://github.com/Nexus-Mods/Vortex/pull/20637))
- Notification aggregator and group rendering protective code
- Main process exception handling
- State backup import fixes

## [1.16.9] - 2026-04-15

### Added

- **Starfield**: Added support for blueprint plugins.
- **FOMOD Variants**: Added the ability to preserve FOMOD presets/installer choices when installing variants. A new checkbox lets users choose between keeping the previous preset or starting from a fresh dialog with auto-select based on existing files. ([#20556](https://github.com/Nexus-Mods/Vortex/issues/20556))

### Changed

- **7-Zip**: Updated bundled 7-Zip to 26.00.
- **libloot**: Updated to 0.29.3.
- **Starfield**: Updated native plugin list for new DLCs.
- **FOMOD Re-install**: Manual FOMOD re-installs now show the dialog with previously selected values pre-populated, instead of toggling between a fresh dialog and a silent re-install. Users who want to keep the preset can click through; those who want to change something can adjust the pre-selection. (Not applied during collection installs.) ([#21864](https://github.com/Nexus-Mods/Vortex/issues/21864))

### Fixed

- **Plugin Management**: Fixed the load order page mechanism switch (rules-based vs. drag-and-drop) requiring an app restart to take effect.
- **Collections**: Collaborators with edit permissions are no longer shown the "different account" warning when editing a collection uploaded by someone else.

## [1.16.8] - 2026-03-31

### Changed

- Updated libloot to 0.29.1
- Restored drag-drop support for non-archive files on the mods page
- Baldur's Gate 3 specific fixes (lslib installer and minor tweaks)

### Fixed

- External changes dialog incorrectly appearing after batch mod reinstallations and updates
- Load order export failing silently when permission elevation was required
- Installer choices still not being preserved during mod reinstalls
- Category column not updating and category filter excluding too many results ([#19423](https://github.com/Nexus-Mods/Vortex/issues/19423), [#21456](https://github.com/Nexus-Mods/Vortex/issues/21456), [#20735](https://github.com/Nexus-Mods/Vortex/issues/20735), [#21820](https://github.com/Nexus-Mods/Vortex/issues/21820))
- Duplicate entries and rule changes being dropped when unlocking conflict rules

## [1.16.7] - 2026-03-17

### Added

- Ability to link profiles to specific collections ([#21283](https://github.com/Nexus-Mods/Vortex/issues/21283))

### Changed

- Upgraded libloot from 0.27.0 to 0.29.0 — plugin sorting ~2x faster
- Re-apply installer choices/preset on manual re-install of a mod

### Fixed

- Confusing "No instructions found" error dialog when toggling mod instructions during a race condition — now logs silently instead ([#21300](https://github.com/Nexus-Mods/Vortex/issues/21300))
- Crash in file-based load order when external entries were not stored as arrays ([#21309](https://github.com/Nexus-Mods/Vortex/issues/21309))
- `editCollection` callback being wrapped incorrectly, causing crash when editing a collection ([#21319](https://github.com/Nexus-Mods/Vortex/issues/21319))
- Crash in dependency graph view when the graph component wasn't initialized yet ([#21327](https://github.com/Nexus-Mods/Vortex/issues/21327))
- Crash in collection overview when the collection's game domain was undefined ([#21328](https://github.com/Nexus-Mods/Vortex/issues/21328))
- Error messages showing empty file paths for ENOENT/EPERM errors when `path`/`filename` was an empty string instead of undefined ([#21337](https://github.com/Nexus-Mods/Vortex/issues/21337), [#21343](https://github.com/Nexus-Mods/Vortex/issues/21343), [#21377](https://github.com/Nexus-Mods/Vortex/issues/21377))
- Crash when accessing `modInfo` on a null download reference during mod installation ([#21338](https://github.com/Nexus-Mods/Vortex/issues/21338))
- `minimatch` throwing on invalid patterns in the dependency blacklist — now catches and skips bad patterns ([#21352](https://github.com/Nexus-Mods/Vortex/issues/21352))
- `winapi.GetPrivateProfileSectionNames` crash on non-Windows platforms by skipping WinAPI ini format on Linux/Mac ([#21355](https://github.com/Nexus-Mods/Vortex/issues/21355))
- Crash when load order contained circular rules — now shows a user-friendly notification instead ([#21356](https://github.com/Nexus-Mods/Vortex/issues/21356))
- Crash from stale OAuth callback arriving after the login flow was already completed or abandoned ([#21362](https://github.com/Nexus-Mods/Vortex/issues/21362))
- `__MACOSX` resource fork directories not being excluded during deployment — case-sensitive match was missing ([#21364](https://github.com/Nexus-Mods/Vortex/issues/21364))
- Win32 `GetLastError` code of 0 (`ERROR_SUCCESS`) overwriting real error messages with "The operation completed successfully" ([#21366](https://github.com/Nexus-Mods/Vortex/issues/21366), [#21375](https://github.com/Nexus-Mods/Vortex/issues/21375), [#21380](https://github.com/Nexus-Mods/Vortex/issues/21380))
- Crash when importing collection plugin rules/groups that weren't exported ([#21381](https://github.com/Nexus-Mods/Vortex/issues/21381))
- Collection overview not re-rendering correctly on install complete

## [1.16.6] - 2026-03-02

- Fixed gamebryo plugin group filter crashing the renderer process ([#20436](https://github.com/Nexus-Mods/Vortex/issues/20436), [#19848](https://github.com/Nexus-Mods/Vortex/issues/19848))
- Fixed attempts to modify readonly error fields ([#20971](https://github.com/Nexus-Mods/Vortex/issues/20971))
- Fixed GitHub SAS tokens not preserved when decoding download URLs ([#20133](https://github.com/Nexus-Mods/Vortex/issues/20133))
- Fixed skipped optional dependencies showing as error notifications ([#21108](https://github.com/Nexus-Mods/Vortex/issues/21108))
- Fixed extension manager error handling for invalid or uninstalled extensions
- Fixed grouping key generation not sanitizing custom file paths
- Fixed version detection when installing different versions of the same mod
- Fixed fomod installer blocking the UI during unattended collection installs
- Batched mod-completion Redux dispatches to reduce expensive re-renders
- Removed superfluous collection mod state dispatches
- Deferred mod dependency rule sorting during collection installs — updates now suppressed during active sessions and triggered before each phase deployment
- Fixed stale progress notifications lingering after install completion
- Improved testModReference matching robustness
- Fixed React state-after-unmount warning in SuccessRating component

## [1.16.5] - 2026-02-25

- Fixed stub extensions not downloading correctly through the games page ([#20967](https://github.com/Nexus-Mods/Vortex/issues/20967))
- Fixed collection stalling indefinitely in some cases
- Fixed file id/inode precision loss when purging files (hardlinks)
- Fixed unsolved conflicts notification reporting resolved conflicts ([#20702](https://github.com/Nexus-Mods/Vortex/issues/20702))
- Fixed logicalFileName false positive reference checks for downloads ([#20870](https://github.com/Nexus-Mods/Vortex/issues/20870))
- Ensured the numeric game id cache is populated before generating UIDs ([#20819](https://github.com/Nexus-Mods/Vortex/issues/20819))
- Added download removal confirmation dialog wrapper/barrier ([#20957](https://github.com/Nexus-Mods/Vortex/issues/20957))
- Improved UI stutter/responsiveness during collection installation
- Improved hash based on stack to better de-duplicate GitHub tickets

## [1.16.4] - 2026-02-19

- Fixed plugin cyclic interaction dialog changes not reflected in userlist ([#19605](https://github.com/Nexus-Mods/Vortex/issues/19605))
- Fixed inconsistent rule checks between unsolved notif and rules dialogs ([#19746](https://github.com/Nexus-Mods/Vortex/issues/19746))
- Fixed permission elevation issues when unlocking mod folder recursively ([#19948](https://github.com/Nexus-Mods/Vortex/issues/19948))
- Added protective code when rendering groups ([#20436](https://github.com/Nexus-Mods/Vortex/issues/20436))
- Added protective code to pluginList to avoid renderer crashes ([#20436](https://github.com/Nexus-Mods/Vortex/issues/20436))
- Added protective code to avoid forwarding nullish values to minimatch during deployment ([#20424](https://github.com/Nexus-Mods/Vortex/issues/20424))
- Fixed renderer crashes when collections extension is disabled ([#20481](https://github.com/Nexus-Mods/Vortex/issues/20481))
- Fixed unhandled ProcessCanceled errors causing app to crash
- Removed debug log entries for the notification aggregator

## [1.16.3] - 2026-02-17

- Fixed collection react components not rerendering correctly
- Fixed history events causing crash if failed to set light flag
- Added error handling for unhandled errors when starting/resuming download
  ([#20306](https://github.com/Nexus-Mods/Vortex/issues/20306), [#20036](https://github.com/Nexus-Mods/Vortex/issues/20036))
- Added protective code to validate potentially invalid download entries
- Fixed race condition causing file assembler to close file prematurely
- Fixed installerChoices potentially not persisting on collection clone
- Fixed myCollections query potentially returning unowned results ([#20257](https://github.com/Nexus-Mods/Vortex/issues/20257))
- Fixed deleting custom themes ([#19324](https://github.com/Nexus-Mods/Vortex/issues/19324))
- Populate pluginList on collection installation
- Fixed mod installations not working for SkyrimVR/FalloutVR ([#19808](https://github.com/Nexus-Mods/Vortex/issues/19808))

## [1.16.2] - 2026-02-12

- Fixed race condition when attempting to generate file UIDs ([#19602](https://github.com/Nexus-Mods/Vortex/issues/19602) and several others)
- Added handling for transient EBUSY errors when starting loot ([#19609](https://github.com/Nexus-Mods/Vortex/issues/19609))
- User cancelled error suppression ([#19619](https://github.com/Nexus-Mods/Vortex/issues/19619))
- Fixed linking issues on mod extraction/install ([#196101](https://github.com/Nexus-Mods/Vortex/issues/19610), [#19626](https://github.com/Nexus-Mods/Vortex/issues/19626), [#19700](https://github.com/Nexus-Mods/Vortex/issues/19700) and several others)
- Suppress error report for user derived FOMOD-IPC timeout errors ([#19641](https://github.com/Nexus-Mods/Vortex/issues/19641))
- Fixed FOMOD native errors when installing XML FOMODs with BOM characters ([#19718](https://github.com/Nexus-Mods/Vortex/issues/19718))
- Fixed attempts to install corrupted/failed downloads ([#19627](https://github.com/Nexus-Mods/Vortex/issues/19627))
- Fixed broken icons on Browse Collections page
- Fixed nested revision queries on collection install and workshop startup ([#19757](https://github.com/Nexus-Mods/Vortex/issues/19757) and several others)
- Added error handling for fatal extraction errors

## [1.16.1] - 2026-02-10

_Stable release based on 1.16.0-beta.5_

### Major Features

- Complete Download/Install Pipeline Refactor - Decoupled downloads from installations, raised concurrency limits, improved phase gating for collections ([#18211](https://github.com/Nexus-Mods/Vortex/issues/18211))
- Phase deployments are no longer required at the end of each phase for mods where the curator has pre-defined the fomod installer choices ([#18467](https://github.com/Nexus-Mods/Vortex/issues/18467))
- Complete FOMOD Installer Native Port - Split FOMOD installer into shared logic and native implementation modules for better performance, reliability, and maintainability ([#18465](https://github.com/Nexus-Mods/Vortex/issues/18465))
- Added Collection Browsing feature - Browse and install collections directly in Vortex ([#18596](https://github.com/Nexus-Mods/Vortex/issues/18596), [#18563](https://github.com/Nexus-Mods/Vortex/issues/18563))
- Upgraded to Electron 37 with Node.js 22 ([#18221](https://github.com/Nexus-Mods/Vortex/issues/18221), [#18311](https://github.com/Nexus-Mods/Vortex/issues/18311))
- Migrated to .NET 9 runtime ([#18220](https://github.com/Nexus-Mods/Vortex/issues/18220))

### Collections Improvements

- Added fully automated/headless installation to FOMOD installer module ([#18466](https://github.com/Nexus-Mods/Vortex/issues/18466))
- Fixed collection install hanging forever when installs are deferred ([#19477](https://github.com/Nexus-Mods/Vortex/issues/19477))
- Fixed collection instructions data being lost on cloning ([#19476](https://github.com/Nexus-Mods/Vortex/issues/19476))
- Fixed Collection Workshop visually defaulting to "Exact Only" but setting "Prefer Exact" ([#19469](https://github.com/Nexus-Mods/Vortex/issues/19469))
- Improved tool comparison when installing collections ([#19370](https://github.com/Nexus-Mods/Vortex/issues/19370))
- Fixed several issues causing collection installations to stall ([#19319](https://github.com/Nexus-Mods/Vortex/pull/19319))
- Fixed UI slowdown when installing recommended/optional mods ([#19318](https://github.com/Nexus-Mods/Vortex/issues/19318))
- Fixed failed download installation lookup for bundled mods ([#19315](https://github.com/Nexus-Mods/Vortex/issues/19315))
- Fixed downloads getting erased incorrectly on rename failure during collection installation ([#19313](https://github.com/Nexus-Mods/Vortex/issues/19313))
- Fixed skipped/ignored mods being downloaded/installed ([#19248](https://github.com/Nexus-Mods/Vortex/issues/19248))
- Fixed bundled mods causing collection installation to hang ([#19217](https://github.com/Nexus-Mods/Vortex/issues/19217))
- Fixed optional mods failing to install due to incorrect dependency reference check ([#19183](https://github.com/Nexus-Mods/Vortex/issues/19183))
- Fixed bundled mods not applying collection mod rules ([#18977](https://github.com/Nexus-Mods/Vortex/issues/18977))
- Fixed critical TypeError crash when resuming collection installation from previous version ([#19125](https://github.com/Nexus-Mods/Vortex/issues/19125))
- Fixed potential crash when collection becomes unavailable during installation ([#19063](https://github.com/Nexus-Mods/Vortex/issues/19063))
- Fixed collection progress tracking bugs ([#18503](https://github.com/Nexus-Mods/Vortex/issues/18503), [#18520](https://github.com/Nexus-Mods/Vortex/issues/18520))
- Fixed collection tracking not highlighting collection as complete ([#18652](https://github.com/Nexus-Mods/Vortex/issues/18652))
- Fixed various collection bugs ([#18651](https://github.com/Nexus-Mods/Vortex/issues/18651))
- "Exact" matching now defaults when creating collections ([#18214](https://github.com/Nexus-Mods/Vortex/issues/18214))
- Added indication of total mod count during collection installs ([#18217](https://github.com/Nexus-Mods/Vortex/issues/18217))
- De-duplicated collection notifications ([#18306](https://github.com/Nexus-Mods/Vortex/issues/18306))
- Improved free user journey with new download/install workflow ([#18215](https://github.com/Nexus-Mods/Vortex/issues/18215))
- Allow users with correct permissions to edit collections ([#18453](https://github.com/Nexus-Mods/Vortex/issues/18453))
- Fixed installation skip of manually downloaded mods that are missing the referenceTag when installing a collection ([#18736](https://github.com/Nexus-Mods/Vortex/issues/18736))
- Fixed ability to export "dead" collection rules when uploading a new revision ([#18709](https://github.com/Nexus-Mods/Vortex/issues/18709))
- Updated to collectionsV2 API for collection browsing ([#18817](https://github.com/Nexus-Mods/Vortex/issues/18817))
- Fixed optional mods not installing correctly for FO4 Anniversary collection ([#18864](https://github.com/Nexus-Mods/Vortex/issues/18864))
- Fixed stalled collection installation when mod archives are present ([#18889](https://github.com/Nexus-Mods/Vortex/issues/18889))
- Fixed race condition causing mods to lack metadata during installation ([#18930](https://github.com/Nexus-Mods/Vortex/issues/18930))
- Added adult content preferences support for collection downloading ([#18777](https://github.com/Nexus-Mods/Vortex/issues/18777))
- Fixed collection conflict check incorrectly blocking new revision uploads ([#18980](https://github.com/Nexus-Mods/Vortex/issues/18980))
- Fixed Install as Variant not being prompted when installing a collection where mods already exist with different FOMOD options ([#18979](https://github.com/Nexus-Mods/Vortex/issues/18979))
- Fixed Mod Configuration Menu (MCM) for Fallout New Vegas failing to install during collection installation ([#18975](https://github.com/Nexus-Mods/Vortex/issues/18975))

### Bug Fixes

- Fixed Dashboard Tools not refreshing on deployment ([#19479](https://github.com/Nexus-Mods/Vortex/issues/19479))
- Fixed crash when path argument is null ([#17771](https://github.com/Nexus-Mods/Vortex/issues/17771))
- Fixed spawn EFTYPE error on Linux ([#19127](https://github.com/Nexus-Mods/Vortex/issues/19127))
- Removed error codes and messages from Mixpanel events ([#19437](https://github.com/Nexus-Mods/Vortex/issues/19437))
- Fixed mod variants not being created for binary patched mods when mod already exists ([#19184](https://github.com/Nexus-Mods/Vortex/issues/19184))
- Fixed installation error when invalid override instructions present ([#19143](https://github.com/Nexus-Mods/Vortex/issues/19143))
- Fixed download failure with "Cannot convert undefined to a BigInt" error ([#19144](https://github.com/Nexus-Mods/Vortex/issues/19144))
- Fixed crash when no groups are available for FOMOD installation ([#19209](https://github.com/Nexus-Mods/Vortex/issues/19209))
- Fixed crash when reading undefined 'data' property ([#18910](https://github.com/Nexus-Mods/Vortex/issues/18910))
- Suppress user-cancelled error reporting during dependency installation ([#19174](https://github.com/Nexus-Mods/Vortex/issues/19174))
- Fixed downgrade dialog text grammar ([#18727](https://github.com/Nexus-Mods/Vortex/issues/18727))
- Fixed master groups showing reversed arrows in plugins view ([#19072](https://github.com/Nexus-Mods/Vortex/issues/19072))
- Fixed stack overflow when resolving external changes during deployment ([#19048](https://github.com/Nexus-Mods/Vortex/issues/19048))
- Fixed extraction failures when archive files are temporarily locked ([#19049](https://github.com/Nexus-Mods/Vortex/issues/19049))
- Fixed conflicting LOOT sort notifications appearing simultaneously ([#18985](https://github.com/Nexus-Mods/Vortex/issues/18985))
- Fixed user cancellation error in Kingdom Come: Deliverance ([#19043](https://github.com/Nexus-Mods/Vortex/issues/19043))
- Fixed master groups showing reversed arrows in groups graph view
- Fixed event listeners executing for unrelated games ([#19043](https://github.com/Nexus-Mods/Vortex/issues/19043))
- Fixed error when updating mods from 'site' domain ([#19011](https://github.com/Nexus-Mods/Vortex/issues/19011))
- Added proper IPC chunking to loot forks ([#19014](https://github.com/Nexus-Mods/Vortex/issues/19014))
- Fixed error handling of 40x errors on free user skip ([#19012](https://github.com/Nexus-Mods/Vortex/issues/19012), [#19009](https://github.com/Nexus-Mods/Vortex/issues/19009))
- Fixed loss of error stack information on dep install failure ([#19007](https://github.com/Nexus-Mods/Vortex/issues/19007))
- Fixed binary patched mod differences not detected correctly ([#18998](https://github.com/Nexus-Mods/Vortex/issues/18998))
- Fixed download failure due to undefined 'id' property when handling download completion ([#18967](https://github.com/Nexus-Mods/Vortex/issues/18967))
- Fixed path argument type error when cleaning up downloads directory ([#18853](https://github.com/Nexus-Mods/Vortex/issues/18853))
- Fixed infinite metadata loop causing "Creating Snapshots" to never complete ([#18811](https://github.com/Nexus-Mods/Vortex/issues/18811))
- Fixed plugins page panel rendering wrong dropdown control ([#18944](https://github.com/Nexus-Mods/Vortex/issues/18944))
- Re-added download stall restart functionality ([#18933](https://github.com/Nexus-Mods/Vortex/issues/18933))
- Fixed mod files query to only use domain name ([#18939](https://github.com/Nexus-Mods/Vortex/pull/18939))
- Fixed storeHelper clone returning same array instead of cloning ([#18955](https://github.com/Nexus-Mods/Vortex/pull/18955))
- Fixed crash on startup when no game is active ([#18898](https://github.com/Nexus-Mods/Vortex/issues/18898))
- Fixed installer issue where certain files are not linked correctly ([#18927](https://github.com/Nexus-Mods/Vortex/issues/18927))
- FOMOD installer now lazy loads for faster startup ([#18868](https://github.com/Nexus-Mods/Vortex/pull/18868))
- Fixed handling of undefined game stores ([#18924](https://github.com/Nexus-Mods/Vortex/pull/18924))
- Fixed incorrect offset for small chunk retry ([#18865](https://github.com/Nexus-Mods/Vortex/issues/18865))
- Fixed crash: reduce is not a function in FOMOD choices ([#18735](https://github.com/Nexus-Mods/Vortex/issues/18735))
- Fixed "Do this for all remaining installs" button not working when reinstalling ([#18752](https://github.com/Nexus-Mods/Vortex/issues/18752))
- Fixed preset re-application on reinstall/variant install ([#18846](https://github.com/Nexus-Mods/Vortex/issues/18846))
- Fixed curated renamed mods not renamed for end-user ([#18824](https://github.com/Nexus-Mods/Vortex/issues/18824))
- Fixed mod types not applying correctly when installing a collection ([#18822](https://github.com/Nexus-Mods/Vortex/issues/18822))
- Fixed mod category info lost during collection download ([#18790](https://github.com/Nexus-Mods/Vortex/issues/18790))
- Fixed downloads folder cleanup ([#18720](https://github.com/Nexus-Mods/Vortex/issues/18720))
- Fixed download reference false positives for fuzzy/bundled mods ([#18719](https://github.com/Nexus-Mods/Vortex/issues/18719))
- Fixed confirmedOffset + confirmedReceived for stalled/slow download workers ([#18827](https://github.com/Nexus-Mods/Vortex/issues/18827))
- Fixed self copy check error on mod extraction ([#18810](https://github.com/Nexus-Mods/Vortex/issues/18810))
- Fixed Game Not Supported Error when downloading a requirement from another game domain ([#18738](https://github.com/Nexus-Mods/Vortex/issues/18738))
- Fixed text in dialogue not displaying properly ([#18768](https://github.com/Nexus-Mods/Vortex/issues/18768))
- Fixed crash: HTTP (403) - Forbidden ([#18764](https://github.com/Nexus-Mods/Vortex/issues/18764))
- Fixed YouTube embedded player sometimes not working ([#18707](https://github.com/Nexus-Mods/Vortex/issues/18707))
- Fixed i18 functionality for string resources ([#18641](https://github.com/Nexus-Mods/Vortex/issues/18641))
- Fixed speedometer displaying incorrect download speeds ([#18213](https://github.com/Nexus-Mods/Vortex/issues/18213))
- Fixed inconsistent installation keys when initially queueing installations ([#18545](https://github.com/Nexus-Mods/Vortex/issues/18545))
- Fixed plugins not sorting properly without restart ([#18486](https://github.com/Nexus-Mods/Vortex/issues/18486))
- Fixed unhandled exception when clicking starter dashlet items ([#18410](https://github.com/Nexus-Mods/Vortex/issues/18410))
- Fixed Electron Redux duplicate action dispatch ([#18507](https://github.com/Nexus-Mods/Vortex/issues/18507))
- Fixed potential race condition if update is running but mod was removed ([#18246](https://github.com/Nexus-Mods/Vortex/issues/18246))
- Fixed objdiff potentially attempting to loop over null and arrays ([#18243](https://github.com/Nexus-Mods/Vortex/issues/18243))
- Fixed nullish checks in mod reference match tests ([#18252](https://github.com/Nexus-Mods/Vortex/issues/18252))
- Fixed crashpad error detail sanitization ([#18251](https://github.com/Nexus-Mods/Vortex/issues/18251))
- Fixed user cancellation errors in Halo MCC ([#18257](https://github.com/Nexus-Mods/Vortex/issues/18257))
- Fixed stop patterns interfering with instruction overrides ([#18593](https://github.com/Nexus-Mods/Vortex/issues/18593))
- Fixed modType conflict functionality raising errors during collection installation when replacing mods ([#18653](https://github.com/Nexus-Mods/Vortex/issues/18653))

### UI/UX Improvements

- Notifications automatically clear on game change ([#18399](https://github.com/Nexus-Mods/Vortex/issues/18399))
- Converted appropriate notifications to toast format ([#18307](https://github.com/Nexus-Mods/Vortex/issues/18307))
- Feedback button now links to Google Form ([#18446](https://github.com/Nexus-Mods/Vortex/issues/18446))
- Various UI/UX fixes for Collections ([#18686](https://github.com/Nexus-Mods/Vortex/issues/18686))
- Removed "Loose Files May Not Get Loaded" notification for Skyrim SE ([#18381](https://github.com/Nexus-Mods/Vortex/issues/18381))
- Fallout New Vegas modding user journey improvements ([#18586](https://github.com/Nexus-Mods/Vortex/issues/18586))
- Allow "Check for Updates" functionality for disabled mods ([#19250](https://github.com/Nexus-Mods/Vortex/issues/19250))
- Improved INI Tweaks help message clarity ([#18729](https://github.com/Nexus-Mods/Vortex/issues/18729))
- Added dialog multi-dismiss for instructions ([#19001](https://github.com/Nexus-Mods/Vortex/issues/19001))

### Plugin Management

- Fixed GraphDialog not updating correctly upon user change ([#18411](https://github.com/Nexus-Mods/Vortex/issues/18411))

### Game Extensions

- **stardewvalley**: Fixed mod configuration sync restoring config file to wrong location ([#19197](https://github.com/Nexus-Mods/Vortex/issues/19197))
- **stardewvalley**: Fixed exception when checking SMAPI version ([#19046](https://github.com/Nexus-Mods/Vortex/issues/19046))

## [1.16.0-beta.5] - 2026-02-03

- Fixed collection install hanging forever when installs are deferred ([#19477](https://github.com/Nexus-Mods/Vortex/issues/19477))
- Fixed collection instructions data being lost on cloning ([#19476](https://github.com/Nexus-Mods/Vortex/issues/19476))
- Fixed Collection Workshop visually defaulting to "Exact Only" but setting "Prefer Exact" ([#19469](https://github.com/Nexus-Mods/Vortex/issues/19469))
- Improved tool comparison when installing collections ([#19370](https://github.com/Nexus-Mods/Vortex/issues/19370))
- Fixed Dashboard Tools not refreshing on deployment ([#19479](https://github.com/Nexus-Mods/Vortex/issues/19479))
- Fixed crash when path argument is null ([#17771](https://github.com/Nexus-Mods/Vortex/issues/17771))
- Fixed spawn EFTYPE error on Linux ([#19127](https://github.com/Nexus-Mods/Vortex/issues/19127))
- Removed error codes and messages from Mixpanel events ([#19437](https://github.com/Nexus-Mods/Vortex/issues/19437))

## [1.16.0-beta.4] - 2026-01-19

- Fixed several issues causing collection installations to stall ([#19319](https://github.com/Nexus-Mods/Vortex/pull/19319))
- Fixed UI slowdown when installing recommended/optional mods ([#19318](https://github.com/Nexus-Mods/Vortex/issues/19318))
- Fixed skipped external downloads not registering correctly as "skipped" ([#19317](https://github.com/Nexus-Mods/Vortex/issues/19317))
- Fixed bundled mod status getting reverted to "downloading" incorrectly ([#19316](https://github.com/Nexus-Mods/Vortex/issues/19316))
- Fixed failed download installation lookup for bundled mods ([#19315](https://github.com/Nexus-Mods/Vortex/issues/19315))
- Fixed collectionsInstallWhileDownloading toggle not functioning ([#19314](https://github.com/Nexus-Mods/Vortex/issues/19314))
- Fixed downloads getting erased incorrectly on rename failure during collection installation ([#19313](https://github.com/Nexus-Mods/Vortex/issues/19313))
- Fixed skipped/ignored mods being downloaded/installed ([#19248](https://github.com/Nexus-Mods/Vortex/issues/19248))
- Fixed bundled mods causing collection installation to hang ([#19217](https://github.com/Nexus-Mods/Vortex/issues/19217))
- Fixed optional mods failing to install due to incorrect dependency reference check ([#19183](https://github.com/Nexus-Mods/Vortex/issues/19183))
- Fixed mod variants not being created for binary patched mods when mod already exists ([#19184](https://github.com/Nexus-Mods/Vortex/issues/19184))
- Fixed bundled mods not applying collection mod rules ([#18977](https://github.com/Nexus-Mods/Vortex/issues/18977))
- Fixed critical TypeError crash when resuming collection installation from previous version ([#19125](https://github.com/Nexus-Mods/Vortex/issues/19125))
- Fixed installation error when invalid override instructions present ([#19143](https://github.com/Nexus-Mods/Vortex/issues/19143))
- Fixed download failure with "Cannot convert undefined to a BigInt" error ([#19144](https://github.com/Nexus-Mods/Vortex/issues/19144))
- Fixed crash when no groups are available for FOMOD installation ([#19209](https://github.com/Nexus-Mods/Vortex/issues/19209))
- Fixed crash when reading undefined 'data' property ([#18910](https://github.com/Nexus-Mods/Vortex/issues/18910))
- Suppress user-cancelled error reporting during dependency installation ([#19174](https://github.com/Nexus-Mods/Vortex/issues/19174))
- Allow "Check for Updates" functionality for disabled mods ([#19250](https://github.com/Nexus-Mods/Vortex/issues/19250))
- Fixed downgrade dialog text grammar ([#18727](https://github.com/Nexus-Mods/Vortex/issues/18727))
- Improved INI Tweaks help message clarity ([#18729](https://github.com/Nexus-Mods/Vortex/issues/18729))
- **stardewvalley**: Fixed mod configuration sync restoring config file to wrong location ([#19197](https://github.com/Nexus-Mods/Vortex/issues/19197))

## [1.16.0-beta.3] - 2025-12-16

- Fixed master groups showing reversed arrows in plugins view ([#19072](https://github.com/Nexus-Mods/Vortex/issues/19072))
- Fixed stack overflow when resolving external changes during deployment ([#19048](https://github.com/Nexus-Mods/Vortex/issues/19048))
- Fixed extraction failures when archive files are temporarily locked ([#19049](https://github.com/Nexus-Mods/Vortex/issues/19049))
- Fixed potential crash when collection becomes unavailable during installation ([#19063](https://github.com/Nexus-Mods/Vortex/issues/19063))
- Fixed conflicting LOOT sort notifications appearing simultaneously ([#18985](https://github.com/Nexus-Mods/Vortex/issues/18985))
- Fixed user cancellation error in Kingdom Come: Deliverance ([#19043](https://github.com/Nexus-Mods/Vortex/issues/19043))
- Fixed master groups showing reversed arrows in groups graph view
- Fixed event listeners executing for unrelated games ([#19043](https://github.com/Nexus-Mods/Vortex/issues/19043))
- **stardewvalley**: Fixed exception when checking SMAPI version ([#19046](https://github.com/Nexus-Mods/Vortex/issues/19046))

## [1.16.0-beta.2] - 2025-12-11

- Fixed error when updating mods from 'site' domain ([#19011](https://github.com/Nexus-Mods/Vortex/issues/19011))
- Added proper IPC chunking to loot forks ([#19014](https://github.com/Nexus-Mods/Vortex/issues/19014))
- Added dialog multi-dismiss for instructions ([#19001](https://github.com/Nexus-Mods/Vortex/issues/19001))
- Fixed error handling of 40x errors on free user skip ([#19012](https://github.com/Nexus-Mods/Vortex/issues/19012), [#19009](https://github.com/Nexus-Mods/Vortex/issues/19009))
- Fixed loss of error stack information on dep install failure ([#19007](https://github.com/Nexus-Mods/Vortex/issues/19007))

## [1.16.0-beta.1] - 2025-12-09

_Major refactor release with Electron 37, .NET 9 upgrade, complete Download/Install pipeline overhaul, FOMOD native port, and new Collection Browsing feature_

### Major Features

- Complete Download/Install Pipeline Refactor - Decoupled downloads from installations, raised concurrency limits, improved phase gating for collections ([#18211](https://github.com/Nexus-Mods/Vortex/issues/18211))
- Phase deployments are no longer required at the end of each phase for mods where the curator has pre-defined the fomod installer choices ([#18467](https://github.com/Nexus-Mods/Vortex/issues/18467))
- Complete FOMOD Installer Native Port - Split FOMOD installer into shared logic and native implementation modules for better performance, reliability, and maintainability ([#18465](https://github.com/Nexus-Mods/Vortex/issues/18465))
- Added Collection Browsing feature - Browse and install collections directly in Vortex ([#18596](https://github.com/Nexus-Mods/Vortex/issues/18596), [#18563](https://github.com/Nexus-Mods/Vortex/issues/18563))
- Upgraded to Electron 37 with Node.js 22 ([#18221](https://github.com/Nexus-Mods/Vortex/issues/18221), [#18311](https://github.com/Nexus-Mods/Vortex/issues/18311))
- Migrated to .NET 9 runtime ([#18220](https://github.com/Nexus-Mods/Vortex/issues/18220))
- Analytics moved to Mixpanel with enhanced system diagnostics ([#18225](https://github.com/Nexus-Mods/Vortex/issues/18225), [#18510](https://github.com/Nexus-Mods/Vortex/issues/18510))

### Collections Improvements

- Added fully automated/headless installation to FOMOD installer module ([#18466](https://github.com/Nexus-Mods/Vortex/issues/18466))
- Fixed phased installation polling issues causing crashes ([#18515](https://github.com/Nexus-Mods/Vortex/issues/18515))
- Fixed collection progress tracking bugs ([#18503](https://github.com/Nexus-Mods/Vortex/issues/18503), [#18520](https://github.com/Nexus-Mods/Vortex/issues/18520))
- Fixed collection tracking not highlighting collection as complete ([#18652](https://github.com/Nexus-Mods/Vortex/issues/18652))
- Fixed various collection bugs ([#18651](https://github.com/Nexus-Mods/Vortex/issues/18651))
- "Exact" matching now defaults when creating collections ([#18214](https://github.com/Nexus-Mods/Vortex/issues/18214))
- Added indication of total mod count during collection installs ([#18217](https://github.com/Nexus-Mods/Vortex/issues/18217))
- De-duplicated collection notifications ([#18306](https://github.com/Nexus-Mods/Vortex/issues/18306))
- Improved free user journey with new download/install workflow ([#18215](https://github.com/Nexus-Mods/Vortex/issues/18215))
- Allow users with correct permissions to edit collections ([#18453](https://github.com/Nexus-Mods/Vortex/issues/18453))
- Collection browsing UX fixes ([#18728](https://github.com/Nexus-Mods/Vortex/issues/18728))
- Fixed collection browsing not scrolling back to top on pagination change ([#18726](https://github.com/Nexus-Mods/Vortex/issues/18726))
- Fixed installation skip of manually downloaded mods that are missing the referenceTag when installing a collection ([#18736](https://github.com/Nexus-Mods/Vortex/issues/18736))
- Fixed ability to export "dead" collection rules when uploading a new revision ([#18709](https://github.com/Nexus-Mods/Vortex/issues/18709))
- Updated to collectionsV2 API for collection browsing ([#18817](https://github.com/Nexus-Mods/Vortex/issues/18817))
- Fixed optional mods not installing correctly for FO4 Anniversary collection ([#18864](https://github.com/Nexus-Mods/Vortex/issues/18864))
- Fixed stalled collection installation when mod archives are present ([#18889](https://github.com/Nexus-Mods/Vortex/issues/18889))
- Fixed race condition causing mods to lack metadata during installation ([#18930](https://github.com/Nexus-Mods/Vortex/issues/18930))
- Added adult content preferences support for collection downloading ([#18777](https://github.com/Nexus-Mods/Vortex/issues/18777))
- Fixed collection conflict check incorrectly blocking new revision uploads ([#18980](https://github.com/Nexus-Mods/Vortex/issues/18980))
- Fixed Install as Variant not being prompted when installing a collection where mods already exist with different FOMOD options ([#18979](https://github.com/Nexus-Mods/Vortex/issues/18979))
- Fixed Mod Configuration Menu (MCM) for Fallout New Vegas failing to install during collection installation ([#18975](https://github.com/Nexus-Mods/Vortex/issues/18975))

### Bug Fixes

- Fixed binary patched mod differences not detected correctly ([#18998](https://github.com/Nexus-Mods/Vortex/issues/18998))
- Fixed download failure due to undefined 'id' property when handling download completion ([#18967](https://github.com/Nexus-Mods/Vortex/issues/18967))
- Fixed path argument type error when cleaning up downloads directory ([#18853](https://github.com/Nexus-Mods/Vortex/issues/18853))
- Fixed infinite metadata loop causing "Creating Snapshots" to never complete ([#18811](https://github.com/Nexus-Mods/Vortex/issues/18811))
- Fixed plugins page panel rendering wrong dropdown control ([#18944](https://github.com/Nexus-Mods/Vortex/issues/18944))
- Re-added download stall restart functionality ([#18933](https://github.com/Nexus-Mods/Vortex/issues/18933))
- Fixed incorrect stack information for aggregated error notifications ([#18949](https://github.com/Nexus-Mods/Vortex/issues/18949))
- Fixed mod files query to only use domain name ([#18939](https://github.com/Nexus-Mods/Vortex/pull/18939))
- Fixed storeHelper clone returning same array instead of cloning ([#18955](https://github.com/Nexus-Mods/Vortex/pull/18955))
- Fixed crash on startup when no game is active ([#18898](https://github.com/Nexus-Mods/Vortex/issues/18898))
- Fixed installer issue where certain files are not linked correctly ([#18927](https://github.com/Nexus-Mods/Vortex/issues/18927))
- FOMOD installer now lazy loads for faster startup ([#18868](https://github.com/Nexus-Mods/Vortex/pull/18868))
- Fixed handling of undefined game stores ([#18924](https://github.com/Nexus-Mods/Vortex/pull/18924))
- Fixed incorrect offset for small chunk retry ([#18865](https://github.com/Nexus-Mods/Vortex/issues/18865))
- Fixed crash: reduce is not a function in FOMOD choices ([#18735](https://github.com/Nexus-Mods/Vortex/issues/18735))
- Fixed "Do this for all remaining installs" button not working when reinstalling ([#18752](https://github.com/Nexus-Mods/Vortex/issues/18752))
- Fixed preset re-application on reinstall/variant install ([#18846](https://github.com/Nexus-Mods/Vortex/issues/18846))
- Fixed curated renamed mods not renamed for end-user ([#18824](https://github.com/Nexus-Mods/Vortex/issues/18824))
- Fixed mod types not applying correctly when installing a collection ([#18822](https://github.com/Nexus-Mods/Vortex/issues/18822))
- Fixed mod category info lost during collection download ([#18790](https://github.com/Nexus-Mods/Vortex/issues/18790))
- Improved notification aggregation when extracting mods ([#18830](https://github.com/Nexus-Mods/Vortex/issues/18830))
- Fixed Mixpanel event crash on mod install ([#18716](https://github.com/Nexus-Mods/Vortex/issues/18716))
- Fixed downloads folder cleanup ([#18720](https://github.com/Nexus-Mods/Vortex/issues/18720))
- Fixed download reference false positives for fuzzy/bundled mods ([#18719](https://github.com/Nexus-Mods/Vortex/issues/18719))
- Fixed confirmedOffset + confirmedReceived for stalled/slow download workers ([#18827](https://github.com/Nexus-Mods/Vortex/issues/18827))
- Fixed self copy check error on mod extraction ([#18810](https://github.com/Nexus-Mods/Vortex/issues/18810))
- Fixed Game Not Supported Error when downloading a requirement from another game domain ([#18738](https://github.com/Nexus-Mods/Vortex/issues/18738))
- Fixed text in dialogue not displaying properly ([#18768](https://github.com/Nexus-Mods/Vortex/issues/18768))
- Fixed crash: HTTP (403) - Forbidden ([#18764](https://github.com/Nexus-Mods/Vortex/issues/18764))
- Fixed YouTube embedded player sometimes not working ([#18707](https://github.com/Nexus-Mods/Vortex/issues/18707))
- Fixed i18 functionality for string resources ([#18641](https://github.com/Nexus-Mods/Vortex/issues/18641))
- Fixed speedometer displaying incorrect download speeds ([#18213](https://github.com/Nexus-Mods/Vortex/issues/18213))
- Fixed inconsistent installation keys when initially queueing installations ([#18545](https://github.com/Nexus-Mods/Vortex/issues/18545))
- Fixed plugins not sorting properly without restart ([#18486](https://github.com/Nexus-Mods/Vortex/issues/18486))
- Fixed 'Download deleted' toast showing on game switch/launch ([#18422](https://github.com/Nexus-Mods/Vortex/issues/18422))
- Fixed unhandled exception when clicking starter dashlet items ([#18410](https://github.com/Nexus-Mods/Vortex/issues/18410))
- Fixed Electron Redux duplicate action dispatch ([#18507](https://github.com/Nexus-Mods/Vortex/issues/18507))
- Fixed potential race condition if update is running but mod was removed ([#18246](https://github.com/Nexus-Mods/Vortex/issues/18246))
- Fixed objdiff potentially attempting to loop over null and arrays ([#18243](https://github.com/Nexus-Mods/Vortex/issues/18243))
- Fixed nullish checks in mod reference match tests ([#18252](https://github.com/Nexus-Mods/Vortex/issues/18252))
- Fixed crashpad error detail sanitization ([#18251](https://github.com/Nexus-Mods/Vortex/issues/18251))
- Fixed user cancellation errors in Halo MCC ([#18257](https://github.com/Nexus-Mods/Vortex/issues/18257))
- Fixed stop patterns interfering with instruction overrides ([#18593](https://github.com/Nexus-Mods/Vortex/issues/18593))
- Fixed modType conflict functionality raising errors during collection installation when replacing mods ([#18653](https://github.com/Nexus-Mods/Vortex/issues/18653))

### UI/UX Improvements

- Notifications automatically clear on game change ([#18399](https://github.com/Nexus-Mods/Vortex/issues/18399))
- Converted appropriate notifications to toast format ([#18307](https://github.com/Nexus-Mods/Vortex/issues/18307))
- Feedback button now links to Google Form ([#18446](https://github.com/Nexus-Mods/Vortex/issues/18446))
- Various UI/UX fixes for Collections ([#18686](https://github.com/Nexus-Mods/Vortex/issues/18686))
- Removed "Loose Files May Not Get Loaded" notification for Skyrim SE ([#18381](https://github.com/Nexus-Mods/Vortex/issues/18381))
- Fallout New Vegas modding user journey improvements ([#18586](https://github.com/Nexus-Mods/Vortex/issues/18586))

### Plugin Management

- Fixed GraphDialog not updating correctly upon user change ([#18411](https://github.com/Nexus-Mods/Vortex/issues/18411))

### Development & Testing

- Added Jest tests for 1.16 refactor work ([#18297](https://github.com/Nexus-Mods/Vortex/issues/18297))
- Added Playwright integration for E2E testing ([#18219](https://github.com/Nexus-Mods/Vortex/issues/18219))
- Created install mod Playwright test ([#18298](https://github.com/Nexus-Mods/Vortex/issues/18298))
- Refactored ComponentEx/nexus_integration selectors to remove circular dependency ([#18414](https://github.com/Nexus-Mods/Vortex/issues/18414))
- Build scripts restored and working ([#18321](https://github.com/Nexus-Mods/Vortex/issues/18321))
- Removed Windows10SDK.19041 dependency ([#18320](https://github.com/Nexus-Mods/Vortex/issues/18320))

---

## [1.16.0-alpha.6] - 2025-12-08

_Stability and deployment improvements_

- Fixed infinite metadata loop causing "Creating Snapshots" to never complete ([#18811](https://github.com/Nexus-Mods/Vortex/issues/18811))
- Fixed plugins page panel rendering wrong dropdown control ([#18944](https://github.com/Nexus-Mods/Vortex/issues/18944))
- Re-added download stall restart functionality ([#18933](https://github.com/Nexus-Mods/Vortex/issues/18933))
- Fixed incorrect stack information for aggregated error notifications ([#18949](https://github.com/Nexus-Mods/Vortex/issues/18949))
- Fixed mod files query to only use domain name ([#18939](https://github.com/Nexus-Mods/Vortex/pull/18939))
- Fixed storeHelper clone returning same array instead of cloning ([#18955](https://github.com/Nexus-Mods/Vortex/pull/18955))

## [1.16.0-alpha.5] - 2025-12-03

_Stability fixes and collection installation improvements_

- Fixed crash on startup when no game is active ([#18898](https://github.com/Nexus-Mods/Vortex/issues/18898))
- Fixed race condition causing mods to lack metadata during installation ([#18930](https://github.com/Nexus-Mods/Vortex/issues/18930))
- Fixed stalled collection installation when mod archives are present ([#18889](https://github.com/Nexus-Mods/Vortex/issues/18889))
- Fixed installer issue where certain files are not linked correctly ([#18927](https://github.com/Nexus-Mods/Vortex/issues/18927))
- FOMOD installer now lazy loads for faster startup ([#18868](https://github.com/Nexus-Mods/Vortex/pull/18868))
- Fixed handling of undefined game stores ([#18924](https://github.com/Nexus-Mods/Vortex/pull/18924))

## [1.16.0-alpha.4] - 2025-11-26

_Fallout series modding improvements and collection installation fixes_

- Fallout New Vegas modding user journey improvements ([#18586](https://github.com/Nexus-Mods/Vortex/issues/18586))
- Fixed optional mods not installing correctly for FO4 Anniversary collection ([#18864](https://github.com/Nexus-Mods/Vortex/issues/18864))
- Fixed MCM for FalloutNV not installing correctly ([#18863](https://github.com/Nexus-Mods/Vortex/issues/18863))
- Fixed incorrect offset for small chunk retry ([#18865](https://github.com/Nexus-Mods/Vortex/issues/18865))
- Fixed crash: reduce is not a function in FOMOD choices ([#18735](https://github.com/Nexus-Mods/Vortex/issues/18735))
- Fixed "Do this for all remaining installs" button not working when reinstalling ([#18752](https://github.com/Nexus-Mods/Vortex/issues/18752))
- Fixed preset re-application on reinstall/variant install ([#18846](https://github.com/Nexus-Mods/Vortex/issues/18846))
- Fixed curated renamed mods not renamed for end-user ([#18824](https://github.com/Nexus-Mods/Vortex/issues/18824))
- Fixed mod types not applying correctly when installing a collection ([#18822](https://github.com/Nexus-Mods/Vortex/issues/18822))
- Fixed mod category info lost during collection download ([#18790](https://github.com/Nexus-Mods/Vortex/issues/18790))
- Added adult content preferences support for collection downloading ([#18777](https://github.com/Nexus-Mods/Vortex/issues/18777))
- Updated to collectionsV2 API for collection browsing ([#18817](https://github.com/Nexus-Mods/Vortex/issues/18817))
- Fixed slow snapshot creation during FO4 deployment ([#18811](https://github.com/Nexus-Mods/Vortex/issues/18811))
- Improved notification aggregation when extracting mods ([#18830](https://github.com/Nexus-Mods/Vortex/issues/18830))
- Removed "Loose Files May Not Get Loaded" notification for Skyrim SE ([#18381](https://github.com/Nexus-Mods/Vortex/issues/18381))

## [1.16.0-alpha.3] - 2025-11-18

_Stability-focused release with FOMOD native port completion, collection browsing improvements, and critical crash fixes_

- Complete FOMOD Installer Native Port - Split FOMOD installer into shared logic and native implementation modules for better performance, reliability, and maintainability ([#18465](https://github.com/Nexus-Mods/Vortex/issues/18465))
- Collection browsing UX fixes ([#18728](https://github.com/Nexus-Mods/Vortex/issues/18728))
- Fixed collection browsing not scrolling back to top on pagination change ([#18726](https://github.com/Nexus-Mods/Vortex/issues/18726))
- Fixed installation skip of manually downloaded mods that are missing the referenceTag when installing a collection ([#18736](https://github.com/Nexus-Mods/Vortex/issues/18736))
- Fixed ability to export "dead" collection rules when uploading a new revision ([#18709](https://github.com/Nexus-Mods/Vortex/issues/18709))
- Fixed Mixpanel event crash on mod install ([#18716](https://github.com/Nexus-Mods/Vortex/issues/18716))
- Fixed downloads folder cleanup ([#18720](https://github.com/Nexus-Mods/Vortex/issues/18720))
- Fixed download reference false positives for fuzzy/bundled mods ([#18719](https://github.com/Nexus-Mods/Vortex/issues/18719))
- Fixed confirmedOffset + confirmedReceived for stalled/slow download workers ([#18827](https://github.com/Nexus-Mods/Vortex/issues/18827))
- Fixed self copy check error on mod extraction ([#18810](https://github.com/Nexus-Mods/Vortex/issues/18810))
- Fixed Game Not Supported Error when downloading a requirement from another game domain ([#18738](https://github.com/Nexus-Mods/Vortex/issues/18738))
- Fixed text in dialogue not displaying properly ([#18768](https://github.com/Nexus-Mods/Vortex/issues/18768))
- Fixed crash: HTTP (403) - Forbidden ([#18764](https://github.com/Nexus-Mods/Vortex/issues/18764))
- Fixed YouTube embedded player sometimes not working ([#18707](https://github.com/Nexus-Mods/Vortex/issues/18707))
- Fixed i18 functionality for string resources ([#18641](https://github.com/Nexus-Mods/Vortex/issues/18641))

## 1.16.0-alpha.2 - 2025-10-29

_Major refactor release with Electron 37, .NET 9 upgrade, complete Download/Install pipeline overhaul, and new Collection Browsing feature_

#### Major Features

- Complete Download/Install Pipeline Refactor - Decoupled downloads from installations, raised concurrency limits, improved phase gating for collections ([#18211](https://github.com/Nexus-Mods/Vortex/issues/18211))
- Phase deployments are no longer required at the end of each phase for mods where the curator has pre-defined the fomod installer choices. Deployments will still happen when the UI component is displayed to the user. ([#18467](https://github.com/Nexus-Mods/Vortex/issues/18467))
- Added Collection Browsing feature - Browse and install collections directly in Vortex ([#18596](https://github.com/Nexus-Mods/Vortex/issues/18596), [#18563](https://github.com/Nexus-Mods/Vortex/issues/18563))
- Upgraded to Electron 37 with Node.js 22 ([#18221](https://github.com/Nexus-Mods/Vortex/issues/18221), [#18311](https://github.com/Nexus-Mods/Vortex/issues/18311))
- Migrated to .NET 9 runtime ([#18220](https://github.com/Nexus-Mods/Vortex/issues/18220))
- Analytics moved to Mixpanel with enhanced system diagnostics ([#18225](https://github.com/Nexus-Mods/Vortex/issues/18225), [#18510](https://github.com/Nexus-Mods/Vortex/issues/18510))

#### Collections Improvements

- Added fully automated/headless installation to FOMOD installer module ([#18466](https://github.com/Nexus-Mods/Vortex/issues/18466))
- Fixed phased installation polling issues causing crashes ([#18515](https://github.com/Nexus-Mods/Vortex/issues/18515))
- Fixed collection progress tracking bugs ([#18503](https://github.com/Nexus-Mods/Vortex/issues/18503), [#18520](https://github.com/Nexus-Mods/Vortex/issues/18520))
- Fixed collection tracking not highlighting collection as complete ([#18652](https://github.com/Nexus-Mods/Vortex/issues/18652))
- Fixed various collection bugs ([#18651](https://github.com/Nexus-Mods/Vortex/issues/18651))
- "Exact" matching now defaults when creating collections ([#18214](https://github.com/Nexus-Mods/Vortex/issues/18214))
- Added indication of total mod count during collection installs ([#18217](https://github.com/Nexus-Mods/Vortex/issues/18217))
- De-duplicated collection notifications ([#18306](https://github.com/Nexus-Mods/Vortex/issues/18306))
- Improved free user journey with new download/install workflow ([#18215](https://github.com/Nexus-Mods/Vortex/issues/18215))
- Allow users with correct permissions to edit collections ([#18453](https://github.com/Nexus-Mods/Vortex/issues/18453))

#### Bug Fixes

- Fixed speedometer displaying incorrect download speeds ([#18213](https://github.com/Nexus-Mods/Vortex/issues/18213))
- Fixed inconsistent installation keys when initially queueing installations ([#18545](https://github.com/Nexus-Mods/Vortex/issues/18545))
- Fixed plugins not sorting properly without restart ([#18486](https://github.com/Nexus-Mods/Vortex/issues/18486))
- Fixed 'Download deleted' toast showing on game switch/launch ([#18422](https://github.com/Nexus-Mods/Vortex/issues/18422))
- Fixed unhandled exception when clicking starter dashlet items ([#18410](https://github.com/Nexus-Mods/Vortex/issues/18410))
- Fixed Electron Redux duplicate action dispatch ([#18507](https://github.com/Nexus-Mods/Vortex/issues/18507))
- Fixed potential race condition if update is running but mod was removed ([#18246](https://github.com/Nexus-Mods/Vortex/issues/18246))
- Fixed objdiff potentially attempting to loop over null and arrays ([#18243](https://github.com/Nexus-Mods/Vortex/issues/18243))
- Fixed nullish checks in mod reference match tests ([#18252](https://github.com/Nexus-Mods/Vortex/issues/18252))
- Fixed crashpad error detail sanitization ([#18251](https://github.com/Nexus-Mods/Vortex/issues/18251))
- Fixed user cancellation errors in Halo MCC ([#18257](https://github.com/Nexus-Mods/Vortex/issues/18257))
- Fixed stop patterns interfering with instruction overrides ([#18593](https://github.com/Nexus-Mods/Vortex/issues/18593))
- Fixed modType conflict functionality raising errors during collection installation when replacing mods ([#18653](https://github.com/Nexus-Mods/Vortex/issues/18653))

#### UI/UX Improvements

- Notifications automatically clear on game change ([#18399](https://github.com/Nexus-Mods/Vortex/issues/18399))
- Converted appropriate notifications to toast format ([#18307](https://github.com/Nexus-Mods/Vortex/issues/18307))
- Feedback button now links to Google Form ([#18446](https://github.com/Nexus-Mods/Vortex/issues/18446))
- Various UI/UX fixes for Collections ([#18686](https://github.com/Nexus-Mods/Vortex/issues/18686))

#### Game Extensions

- **palworld**: Fixed mods.txt format ([#18540](https://github.com/Nexus-Mods/Vortex/issues/18540))
- **nomanssky**: Fixed Engine Injector mod type pointing to wrong directory ([#18578](https://github.com/Nexus-Mods/Vortex/issues/18578))
- **7dtd**: Fixed fallbackPurge being called during UDF setting ([#18205](https://github.com/Nexus-Mods/Vortex/issues/18205))
- **halomasterchiefcollection**: Fixed user cancellation errors ([#18257](https://github.com/Nexus-Mods/Vortex/issues/18257))

#### Plugin Management

- Fixed GraphDialog not updating correctly upon user change ([#18411](https://github.com/Nexus-Mods/Vortex/issues/18411))

#### Development & Testing

- Added Jest tests for 1.16 refactor work ([#18297](https://github.com/Nexus-Mods/Vortex/issues/18297))
- Added Playwright integration for E2E testing ([#18219](https://github.com/Nexus-Mods/Vortex/issues/18219))
- Created install mod Playwright test ([#18298](https://github.com/Nexus-Mods/Vortex/issues/18298))
- Refactored ComponentEx/nexus_integration selectors to remove circular dependency ([#18414](https://github.com/Nexus-Mods/Vortex/issues/18414))
- Build scripts restored and working ([#18321](https://github.com/Nexus-Mods/Vortex/issues/18321))
- Removed Windows10SDK.19041 dependency ([#18320](https://github.com/Nexus-Mods/Vortex/issues/18320))

## [1.15.2] - 2025-09-16

- Fixed objdiff potentially attempting to loop over null and arrays. ([#18243](https://github.com/Nexus-Mods/Vortex/issues/18243))
- Fixed potential race condition if update is running but mod was removed. ([#18246](https://github.com/Nexus-Mods/Vortex/issues/18246))
- Added error details sanitization to prevent crashpad issues ([#18251](https://github.com/Nexus-Mods/Vortex/issues/18251), [#18250](https://github.com/Nexus-Mods/Vortex/issues/18250))
- Fixed nullish checks in mod reference match tests. ([#18252](https://github.com/Nexus-Mods/Vortex/issues/18252))
- Fixed inconsistent promise chain potentially raising TypeError. ([#18288](https://github.com/Nexus-Mods/Vortex/issues/18288))
- Fixed logging attempt of potentially nullish dependency reference. ([#18280](https://github.com/Nexus-Mods/Vortex/issues/18280))
- Fixed crash if category data is corrupted. ([#18283](https://github.com/Nexus-Mods/Vortex/issues/18283))
- Fixed downloads creating folders based on domain rather than internal id. ([#18262](https://github.com/Nexus-Mods/Vortex/issues/18262))
- **halomasterchiefcollection**: Fixed unhandled event listener errors. ([#18257](https://github.com/Nexus-Mods/Vortex/issues/18257))
- **7dtd**: Fixed fallbackPurge getting called during UDF setting. ([#18205](https://github.com/Nexus-Mods/Vortex/issues/18205))

## [1.15.1] - 2025-09-10

_Stable release based on 1.15.0-beta.3_

- Fixed and consolidated multi-select update/update all functionality ([#18229](https://github.com/Nexus-Mods/Vortex/issues/18229))
- Adding ability to update mods using multi-selection menu. ([#18209](https://github.com/Nexus-Mods/Vortex/issues/18209))
- Fixed "Update All" functionality updating disabled/uninstalled mods. ([#18209](https://github.com/Nexus-Mods/Vortex/issues/18209))
- Fixed exception when attempting to "Open Archive" and the archive is missing. ([#18181](https://github.com/Nexus-Mods/Vortex/issues/18181))
- Fixed disabled plugins being sorted to the bottom of the plugins page ([#18137](https://github.com/Nexus-Mods/Vortex/issues/18137))
- .NET 6 and MSVC 2022 are now bundled with the installer
- Updated Premium branding
- Optimized user subscription checking
- Fixed download queue memory leak
- Fixed warnings raised on startup for old bundled extensions
- Adding ability to update all nexus sourced mods in one go. ([#17612](https://github.com/Nexus-Mods/Vortex/issues/17612))
- Fixed game store helper potentially losing data during discovery. ([#17373](https://github.com/Nexus-Mods/Vortex/issues/17373), [#7](https://github.com/Nexus-Mods/game-oblivionremastered/issues/7))
- Fixed profile mod sanitization causing long profile switches. ([#18073](https://github.com/Nexus-Mods/Vortex/issues/18073))
- Adding ability to view/copy modtype id using mods panel widget
- Improved error message for expired/not valid certificates
- **bepinex**: Fixed mod download loop when the custom package downloader is used. ([bepinex#12](https://github.com/Nexus-Mods/extension-modtype-bepinex/pull/12))
- **fallout4/skyrimse**: FO4/SSE added epic launcher support. ([games#168](https://github.com/Nexus-Mods/vortex-games/pull/168))
- **collections**: Added API-based metrics endpoint usage
- **collections**: Fixed error message for mismatched hashes when using replicate option. ([#18186](https://github.com/Nexus-Mods/Vortex/issues/18186))
- **collections**: Restrict blocked users from interacting with collection. ([#17636](https://github.com/Nexus-Mods/Vortex/issues/17636))
- **plugin-management**: Fixed libloot potentially running in the background while installing collections
- **stardewvalley**: Fixed configuration mod not applied when SMAPI installed manually. ([#17107](https://github.com/Nexus-Mods/Vortex/issues/17107), [#17093](https://github.com/Nexus-Mods/Vortex/issues/17093))
- **mod-content**: Fixed mod content column not displaying FOMOD installations. ([#17634](https://github.com/Nexus-Mods/Vortex/issues/17634))

## 1.15.0-beta.3 - 2025-09-09

- Fixed and consolidated multi-select update/update all functionality ([#18229](https://github.com/Nexus-Mods/Vortex/issues/18229))

## 1.15.0-beta.2 - 2025-09-08

- Adding ability to update mods using multi-selection menu. ([#18209](https://github.com/Nexus-Mods/Vortex/issues/18209))
- Fixed "Update All" functionality updating disabled/uninstalled mods. ([#18209](https://github.com/Nexus-Mods/Vortex/issues/18209))
- Fixed exception when attempting to "Open Archive" and the archive is missing. ([#18181](https://github.com/Nexus-Mods/Vortex/issues/18181))
- Fixed disabled plugins being sorted to the bottom of the plugins page ([#18137](https://github.com/Nexus-Mods/Vortex/issues/18137))

## 1.15.0-beta.1 - 2025-09-03

- .NET 6 and MSVC 2022 are now bundled with the installer
- Updated Premium branding
- Optimized user subscription checking
- Fixed download queue memory leak
- Fixed warnings raised on startup for old bundled extensions
- Adding ability to update all nexus sourced mods in one go. ([#17612](https://github.com/Nexus-Mods/Vortex/issues/17612))
- Fixed game store helper potentially losing data during discovery. ([#17373](https://github.com/Nexus-Mods/Vortex/issues/17373), [#7](https://github.com/Nexus-Mods/game-oblivionremastered/issues/7))
- Fixed profile mod sanitization causing long profile switches. ([#18073](https://github.com/Nexus-Mods/Vortex/issues/18073))
- Adding ability to view/copy modtype id using mods panel widget
- Improved error message for expired/not valid certificates
- **bepinex**: Fixed mod download loop when the custom package downloader is used. ([bepinex#12](https://github.com/Nexus-Mods/extension-modtype-bepinex/pull/12))
- **fallout4/skyrimse**: FO4/SSE added epic launcher support. ([games#168](https://github.com/Nexus-Mods/vortex-games/pull/168))
- **collections**: Added API-based metrics endpoint usage
- **collections**: Fixed error message for mismatched hashes when using replicate option. ([#18186](https://github.com/Nexus-Mods/Vortex/issues/18186))
- **collections**: Restrict blocked users from interacting with collection. ([#17636](https://github.com/Nexus-Mods/Vortex/issues/17636))
- **plugin-management**: Fixed libloot potentially running in the background while installing collections
- **stardewvalley**: Fixed configuration mod not applied when SMAPI installed manually. ([#17107](https://github.com/Nexus-Mods/Vortex/issues/17107), [#17093](https://github.com/Nexus-Mods/Vortex/issues/17093))
- **mod-content**: Fixed mod content column not displaying FOMOD installations. ([#17634](https://github.com/Nexus-Mods/Vortex/issues/17634))

## 1.14.11 - 2025-08-12

- Fixed unhandled exception when launching games without installed collections/mods ([#18022](https://github.com/Nexus-Mods/Vortex/issues/18022))

## 1.14.10 - 2025-08-06

- Improved collection install tracking

## 1.14.9 - 2025-07-31

- Fixed inability to export using replicate when deleting files. ([#17982](https://github.com/Nexus-Mods/Vortex/issues/17982))
- **collections**: Fixed intermittent download version resolution error when installing collections.
- **collections**: Greatly simplified checksum matching when exporting with replicate
- **plugin-management**: fixed plugin info not retrieved if plugin contains no metadata (light plugins identification). ([#17962](https://github.com/Nexus-Mods/Vortex/issues/17962))

## 1.14.8 - 2025-07-08

- MSVC 2022 distributable will now install alongside Vortex to fix crashes for Windows 10 users
- Fixed downloads going into the wrong game folder
- The File Based Overrides not working as expected in some situations
- **plugin-management**: Fixed plugins not auto-sorting on deployment

## 1.14.7 - 2025-07-03

- Fixes the recursive sorting loop. ([#17842](https://github.com/Nexus-Mods/Vortex/issues/17842), [#17810](https://github.com/Nexus-Mods/Vortex/issues/17810))
- Updated libloot to 0.27.0

## 1.14.6 - 2025-07-02

- Fixed crash if reference version matching property is nullish. ([#17801](https://github.com/Nexus-Mods/Vortex/issues/17801))
- Fixed wrong domain assigned to downloads if dlInfo is incorrect. ([#17808](https://github.com/Nexus-Mods/Vortex/issues/17808))
- Reduced log spam for when installing collections
- Fixed race condition causing file not found errors. ([#17799](https://github.com/Nexus-Mods/Vortex/issues/17799), [#17808](https://github.com/Nexus-Mods/Vortex/issues/17808))
- **collections**: Use new urls when opening collection related pages
- **witcher3**: Improved error handling when game is missing native xmls. ([#17776](https://github.com/Nexus-Mods/Vortex/issues/17776))
- **plugin-management**: Fixed sorting action failing if an invalid plugin is detected
- **modtype-bepinex**: Fixed couldn't find matching BIX asset error for pre 6.0.0 versions

## 1.14.5 - 2025-06-25

Fixed inability to download community extensions through the games page.

## 1.14.4 - 2025-06-24

- Fixed override instructions not being applied correctly
- Fixed instances where collection claimed mods are uninstalled
- Fixed dependency installation errors if game becomes unmanaged. ([#17685](https://github.com/Nexus-Mods/Vortex/issues/17685))
- Added error handling for completed downloads that can't be processed. ([#17707](https://github.com/Nexus-Mods/Vortex/issues/17707))
- Avoid render attempts of invalid LO entries. ([#17669](https://github.com/Nexus-Mods/Vortex/issues/17669))
- Log attempts to find a mod using an undefined reference. ([#17680](https://github.com/Nexus-Mods/Vortex/issues/17680),[#17710](https://github.com/Nexus-Mods/Vortex/issues/17710))
- Consolidated loadOrder db queries across FBLO API. ([#17703](https://github.com/Nexus-Mods/Vortex/issues/17703),[#17719](https://github.com/Nexus-Mods/Vortex/issues/17719))
- Fixed potential attempts to start downloads that have already started. ([#17713](https://github.com/Nexus-Mods/Vortex/issues/17713))
- Bypass file override checks if no instructions were generated. ([#17708](https://github.com/Nexus-Mods/Vortex/issues/17708))
- **collections**: Fixed incorrect crc hash mismatch errors blocking collection publish. ([#17748](https://github.com/Nexus-Mods/Vortex/issues/17748))
- **collections**: Fixed checksum exception when using replicate install mode. ([#17712](https://github.com/Nexus-Mods/Vortex/issues/17712))
- **witcher3**: Improved error handling when merging xml files. ([#17700](https://github.com/Nexus-Mods/Vortex/issues/17700))

## 1.14.3 - 2025-06-17

- Load order entry restoration is now profile-based
- Fixed fuzzy version mod reference check. ([#17676](https://github.com/Nexus-Mods/Vortex/issues/17676))
- Fixed override instructions ignored by fomod installer
- **collections**: Added checksum tests when exporting a collection with replicate. ([#17368](https://github.com/Nexus-Mods/Vortex/issues/17368))
- **plugin-management**: Avoid sorting ghosted plugins. ([#17677](https://github.com/Nexus-Mods/Vortex/issues/17677))
- **plugin-management**: Fixed mod name column not rendering correctly. ([#17678](https://github.com/Nexus-Mods/Vortex/issues/17678), [#17652](https://github.com/Nexus-Mods/Vortex/issues/17652))

## 1.14.2 - 2025-06-12

- Fixed blacklist blocking deployment when file overrides defined

## 1.14.1 - 2025-06-10

_Stable release based on 1.14.0-beta.7_

- Updated libloot to 0.26.3
- Updated loot masterlist
- Updating libloot dependency due to rules changes when sorting OBR master plugins
- Added loot support for Oblivion: Remastered
- Added the ability to provide semver coercion options
- Added Vortex profiles tutorial
- Added ability to sort Load Order by deployment order. ([#16886](https://github.com/Nexus-Mods/Vortex/issues/16886))
- Adding ability to import and install archives via cmdline. ([#16896](https://github.com/Nexus-Mods/Vortex/issues/16896))
- Added filter search bar to FBLO
- Added ability to override mod installation instructions
- Added "Update Extensions" button to extensions page. ([17289](https://github.com/Nexus-Mods/Vortex/issues/17289))
- Updated copyright text
- Updated Onboarding videos
- Changed Mods of the Month to Mods Spotlight
- Removed next subdomain
- Prefer game shortName for navigation title
- Improved rule processing functionality
- Improved error handling for network outages while installing collections. ([#17415](https://github.com/Nexus-Mods/Vortex/issues/17415))
- Improved metadata lookup for locally imported downloads
- Provide better error message when encountering cloudflare errors
- Added sanity checks to activation diff. ([#17117](https://github.com/Nexus-Mods/Vortex/issues/17117))
- Fixed default blacklist entries being ignored.
- Fixed FBLO API not maintaining positions of external load order entries
- Fixed FBLO API not maintaining position of loadorder entries that are sourced from the same mod page.
- Fixed tool dashlet "Run" action not functioning ([#17466](https://github.com/Nexus-Mods/Vortex/pull/17466))
- Fixed wrapping of some game titles on the Games page
- Fixed race conditions causing file-based load order re-renders.
- Fixed nullish check for attribute extractor blobs. ([#17309](https://github.com/Nexus-Mods/Vortex/issues/17309))
- Fixed crash when setting LO of removed profile. ([#17162](https://github.com/Nexus-Mods/Vortex/issues/17162))
- Fixed recursive folder creation during staging path transfer. ([#16711](https://github.com/Nexus-Mods/Vortex/issues/16711))
- Fixed Load Order being automatically restored upon validation error. ([#17249](https://github.com/Nexus-Mods/Vortex/issues/17249))
- Fixed merged mods raising the External Changes dialog incorrectly
- Fixed inability to update site domain tools. ([16480](https://github.com/Nexus-Mods/Vortex/issues/16480))
- FBLO filter now filters by id if name doesn't exist
- **7daystodie**: Added ability to modify the user data folder.
- **collections**: Speed optimizations when installing collections and various performance tweaks ([#16858](https://github.com/Nexus-Mods/Vortex/issues/16858), [#16871](https://github.com/Nexus-Mods/Vortex/issues/16871), [#16906](https://github.com/Nexus-Mods/Vortex/issues/16906))
- **collections**: Fixed crash if unable to resolve collection mod rules when cloning. ([#17149](https://github.com/Nexus-Mods/Vortex/issues/17149))
- **collections**: Added ability to quickly create a collection based on active profile
- **collections**: Adding quick collection to start-page card
- **collections**: Concurrent installation tweaks
- **collections**: Removed next subdomain
- **collections**: Fixed invalid event handler. ([#17315](https://github.com/Nexus-Mods/Vortex/issues/17315))
- **gta5/rdr2**: Fixed blocking of deployment during profile changes
- **mod-content**: Adding ability to filter by mods with FOMOD options. ([#17227](https://github.com/Nexus-Mods/Vortex/issues/17227))
- **mod-dependency-manager**: Fixed rare crash when previewing files in override editor. ([#16929](https://github.com/Nexus-Mods/Vortex/issues/16929))
- **mod-dependency-manager**: Fixed exception when trying to map invalid dependency rules. ([#17233](https://github.com/Nexus-Mods/Vortex/issues/17233))
- **mod-dependency-manager**: Fixed log spam when installing collections
- **modtype-bepinex**: Improved injector installer to support nested/non-standard BepInEx packaging
- **nomanssky**: Adding custom game version resolution
- **open-directory**: Added ability to open archive from mods page. ([#16929](https://github.com/Nexus-Mods/Vortex/issues/16929))
- **plugin-management**: Fixed plugin page displaying overriden mod as source
- **plugin-management**: Load order attribute/column is now the default column
- **plugin-management**: fixed loot error when removing mods on startup. ([#17593](https://github.com/Nexus-Mods/Vortex/issues/17593))
- **plugin-management**: Now sanitizing gamesupport data before passing through IPC. ([#17573](https://github.com/Nexus-Mods/Vortex/issues/17573))
- **stardewvalley**: Fixed mod file filtering for archives with multiple manifests
- **witcher3**: Several fixes and improvements to merging of .settings files
- **witcher3**: Various game support fixes and improvements
- **witcher3**: Modernised and improved XML configuration merging (all native .xml files are now mergeable)
- **witcher3**: Fixed incorrect detection of certain menu mod structures. ([#17312](https://github.com/Nexus-Mods/Vortex/issues/17312))

## 1.14.0-beta.7 - 2025-06-05

- Updating libloot dependency due to rules changes when sorting OBR master plugins

## 1.14.0-beta.6 - 2025-06-03

- Fixed default blacklist entries being ignored.
- Improved error handling for network outages while installing collections. ([#17415](https://github.com/Nexus-Mods/Vortex/issues/17415))
- **plugin-management**: fixed loot error when removing mods on startup. ([#17593](https://github.com/Nexus-Mods/Vortex/issues/17593))
- **7daystodie**: Added ability to modify the user data folder.

## 1.14.0-beta.5 - 2025-05-28

- **plugin-management**: Now sanitizing gamesupport data before passing through IPC. ([#17573](https://github.com/Nexus-Mods/Vortex/issues/17573))

## 1.14.0-beta.4 - 2025-05-27

- Updated loot masterlist
- Updated libloot to 0.26.2
- Added loot support for Oblivion: Remastered

## 1.14.0-beta.3 - 2025-05-15

- Fixed FBLO API not maintaining positions of external load order entries
- Fixed FBLO API not maintaining position of loadorder entries that are sourced from the same mod page.
- Fixed tool dashlet "Run" action not functioning ([#17466](https://github.com/Nexus-Mods/Vortex/pull/17466))

## 1.14.0-beta.2 - 2025-03-31

- Updated copyright text
- Fixed wrapping of some game titles on the Games page
- Improved rule processing functionality
- Removed next subdomain
- Prefer game shortName for navigation title
- Fixed race conditions causing file-based load order re-renders.
- Fixed nullish check for attribute extractor blobs. ([#17309](https://github.com/Nexus-Mods/Vortex/issues/17309))
- **gta5/rdr2**: Fixed blocking of deployment during profile changes
- **mod-dependency-manager**: Fixed log spam when installing collections
- **plugin-management**: Load order attribute/column is now the default column
- **collections**: Removed next subdomain
- **collections**: Fixed invalid event handler. ([#17315](https://github.com/Nexus-Mods/Vortex/issues/17315))
- **witcher3**: Fixed incorrect detection of certain menu mod structures. ([#17312](https://github.com/Nexus-Mods/Vortex/issues/17312))

## 1.14.0-beta.1 - 2025-03-11

- Added the ability to provide semver coercion options
- Fixed crash when setting LO of removed profile. ([#17162](https://github.com/Nexus-Mods/Vortex/issues/17162))
- FBLO filter now filters by id if name doesn't exist
- Provide better error message when encountering cloudflare errors
- Added sanity checks to activation diff. ([#17117](https://github.com/Nexus-Mods/Vortex/issues/17117))
- Added Vortex profiles tutorial
- Added ability to sort Load Order by deployment order. ([#16886](https://github.com/Nexus-Mods/Vortex/issues/16886))
- Adding ability to import and install archives via cmdline. ([#16896](https://github.com/Nexus-Mods/Vortex/issues/16896))
- Fixed recursive folder creation during staging path transfer. ([#16711](https://github.com/Nexus-Mods/Vortex/issues/16711))
- Improved metadata lookup for locally imported downloads
- Updated Onboarding videos
- Changed Mods of the Month to Mods Spotlight
- Added filter search bar to FBLO
- Fixed Load Order being automatically restored upon validation error. ([#17249](https://github.com/Nexus-Mods/Vortex/issues/17249))
- Added ability to override mod installation instructions
- Fixed merged mods raising the External Changes dialog incorrectly
- Fixed inability to update site domain tools. ([16480](https://github.com/Nexus-Mods/Vortex/issues/16480))
- Added "Update Extensions" button to extensions page. ([17289](https://github.com/Nexus-Mods/Vortex/issues/17289))
- **open-directory**: Added ability to open archive from mods page. ([#16929](https://github.com/Nexus-Mods/Vortex/issues/16929))
- **plugin-management**: Fixed plugin page displaying overriden mod as source
- **mod-dependency-manager**: Fixed rare crash when previewing files in override editor. ([#16929](https://github.com/Nexus-Mods/Vortex/issues/16929))
- **mod-dependency-manager**: Fixed exception when trying to map invalid dependency rules. ([#17233](https://github.com/Nexus-Mods/Vortex/issues/17233))
- **mod-content**: Adding ability to filter by mods with FOMOD options. ([#17227](https://github.com/Nexus-Mods/Vortex/issues/17227))
- **collections**: Speed optimizations when installing collections and various performance tweaks ([#16858](https://github.com/Nexus-Mods/Vortex/issues/16858), [#16871](https://github.com/Nexus-Mods/Vortex/issues/16871), [#16906](https://github.com/Nexus-Mods/Vortex/issues/16906))
- **collections**: Fixed crash if unable to resolve collection mod rules when cloning. ([#17149](https://github.com/Nexus-Mods/Vortex/issues/17149))
- **collections**: Added ability to quickly create a collection based on active profile
- **collections**: Adding quick collection to start-page card
- **collections**: Concurrent installation tweaks
- **modtype-bepinex**: Improved injector installer to support nested/non-standard BepInEx packaging
- **stardewvalley**: Fixed mod file filtering for archives with multiple manifests
- **nomanssky**: Adding custom game version resolution
- **witcher3**: Several fixes and improvements to merging of .settings files
- **witcher3**: Various game support fixes and improvements
- **witcher3**: Modernised and improved XML configuration merging (all native .xml files are now mergeable)

## [1.13.7] - 2025-01-21

- Suppressed mod combine action during collection install. ([#16889](https://github.com/Nexus-Mods/Vortex/issues/16889))
- Added data validation to game path info provider. ([#17028](https://github.com/Nexus-Mods/Vortex/issues/17028))
- Fixed rare case where attempting to update LO with null parameters. ([#17047](https://github.com/Nexus-Mods/Vortex/issues/17047))

## [1.13.6] - 2025-01-20

- Added sanity check to the setLoadOrder action
- **baldursgate3**: Fixed incorrect action use during import from file

## [1.13.5] - 2025-01-07

_Stable release based on 1.13.4-beta.1_

- Fixed intermittent Load Order reset when installing a mod

## 1.13.4-beta.1 - 2024-12-19

_Pre-release before xmas break. Barely distribtued._

- Fixed intermittent Load Order reset when installing a mod

## [1.13.3] - 2024-12-10

- Added notification for optional extension requirements
- Updated 7zip binaries to latest version
- **stardewvalley**: Fixed config mod sync failure. ([#16760](https://github.com/Nexus-Mods/Vortex/issues/16760))

## [1.13.2] - 2024-12-03

- Fixed rendering of categories
- Added ability to define optional extension requirements
- **stardewvalley**: Fixed potential attempts to parse manifests of uninstalled mods. ([#16650](https://github.com/Nexus-Mods/Vortex/issues/16650))
- **falloutnv**: Sanity checks extension is now optional

## [1.13.1] - 2024-12-02

_Stable release based on [1.13.0-beta.7]_

- Fixed exception when unmanaging (some) community game extensions. ([#16507](https://github.com/Nexus-Mods/Vortex/issues/16507), [#16372](https://github.com/Nexus-Mods/Vortex/issues/16372))
- Fixed attempts to import local downloads when no game is active. ([#16363](https://github.com/Nexus-Mods/Vortex/issues/16363))
- Improved checks for mod updates. ([#16453](https://github.com/Nexus-Mods/Vortex/issues/16453))
- Resolve mod installation profile query (if only 1 available). ([#16438](https://github.com/Nexus-Mods/Vortex/issues/16438))
- Added multi-select drag-and-drop to file-based load order.
- Added direct index typing to file-based load order.
- Added ability to modify the index of a load order entry using keyboard (click on index and modify it)
- Added ability to run up to 3 dependency installers in parallel
- Added FNV sanity checks extension as a requirement for Fallout New Vegas
- Removed redundant check when generating extended items.
- Fixed/Removed redundant deployment events during collection installation.
- Fixed inability to install non-extensions from site domain. ([#16481](https://github.com/Nexus-Mods/Vortex/issues/16481))
- Fixed manual deployment actions not recognized correctly.
- Fixed manual file override assignment if/when mod has multiple matching file base names.
- Fixed FBLO spamming log information for games that do not use that component (e.g. Skyrim).
- Fixed redundant file override logic execution when nothing had changed.
- Fixed FOLON/FO4 mixed collection issue. ([#16305](https://github.com/Nexus-Mods/Vortex/issues/16305))
- Less generic error for rate limit breaches.
- Added ability to disable the experimental move deployment method through the game registration call. ([#16200](https://github.com/Nexus-Mods/Vortex/issues/16200))
- Fixed premature fileName reference comparison failure during collection install
- Fixed download throttling when application is in background
- Write the extensions manifest atomically to avoid corruption. ([#16666](https://github.com/Nexus-Mods/Vortex/issues/16666), [#16655](https://github.com/Nexus-Mods/Vortex/issues/16655))
- Fixed checkboxes not rendering on load order entries.
- Fixed exception when attempting to resolve the version of manually added mods without metadata
- Fixed crash when attempting to group by enabled state and mods are being actively removed. ([#16609](https://github.com/Nexus-Mods/Vortex/issues/16609))
- Fixed exception when attempting to see if the user is logged in. ([#16600](https://github.com/Nexus-Mods/Vortex/issues/16600))
- Fixed failed profile switch when managing game using symlinks
- Fixed download notification spamming the UI during collection install
- Fixes GameId/domainName reverse conversion not catering for multiple compatible games
- Improved Vortex corruption error message. ([#16591](https://github.com/Nexus-Mods/Vortex/issues/16591))
- Fixes semantic coercion with leading zeroes
- Fixed semver bug when whitespace in mod versions
- Fixed promise chain when applying ini tweaks for Gamebryo games
- Fixed incorrect fallback mod update selection
- Fixed updater ignoring pre-release tag
- Adding alternative game domains to future-proof API changes
- **api**: Updated libloot to 0.24.5
- **api**: Added coreceVersion as an API utility function ([#16304](https://github.com/Nexus-Mods/Vortex/issues/16304))
- **api**: (Deprecated) libxmljs is no longer exported as part of Vortex's API.
- **api**: Fixed load order entries losing their index on mod update/re-install. ([#16086](https://github.com/Nexus-Mods/Vortex/issues/16086))
- **collections**: Fixed crash when switching profiles in the collection install dialog. ([#16242](https://github.com/Nexus-Mods/Vortex/issues/16242))
- **collections**: Now uses improved coercion to better support dependency detection
- **collections**: Added context menu action to apply collection rules manually
- **collections**: Fixed collapsed mods tab table
- **mod-dependency-manager**: No longer trim the versions of the mods to 3 digits
- **modtype-bepinex**: Improved error handling for when no matching bepinex pack is found. ([#15933](https://github.com/Nexus-Mods/Vortex/issues/15933))
- **modtype-bepinex**: Fixed installation error when installing BepInEx 6.0. ([#16587](https://github.com/Nexus-Mods/Vortex/issues/16587), [#15933](https://github.com/Nexus-Mods/Vortex/issues/15933))
- **modtype-bepinex**: Fixed issues with BepInEx's mod entry update.
- **7daystodie**: Attempts to block UDF from being set to Vortex directories
- **7daystodie**: Fixed UDF dialog being raised incorrectly
- **baldursgate3**: Fix to support Patch 7 load order format. ([#16384](https://github.com/Nexus-Mods/Vortex/issues/16384))
- **masterchiefcollection**: Reduced mod depth to better support the new mod type
- **stardewvalley**: Adds Settings option to backup mod config files. ([#15419](https://github.com/Nexus-Mods/Vortex/issues/15419))
- **witcher3**: Fixed incorrect mod type assignment for certain mods
- **witcher3**: Allows more granular load order support (multiple entries per mod)
- **witcher3**: Fixes menu mod re-generation as part of collections
- **witcher3**: Fixed minor issues caused by case sensitive checks

## [1.13.0-beta.7] - 2024-11-26

- Fixed download throttling when application is in background
- Fixed FBLO crash if mod removed while mutating the load order. ([#16585](https://github.com/Nexus-Mods/Vortex/issues/16585))
- Write the extensions manifest atomically to avoid corruption. ([#16666](https://github.com/Nexus-Mods/Vortex/issues/16666), [#16655](https://github.com/Nexus-Mods/Vortex/issues/16655))

## [1.13.0-beta.6] - 2024-11-18

- **witcher3**: Allows more granular load order support (multiple entries per mod)
- **witcher3**: Fixes menu mod re-generation as part of collections
- **7daystodie**: Attempts to block UDF from being set to Vortex directories
- **stardewvalley**: Adds Settings option to backup mod config files. ([#15419](https://github.com/Nexus-Mods/Vortex/issues/15419))

## [1.13.0-beta.5] - 2024-11-12

- Fixed exception when attempting to resolve the version of manually added mods without metadata
- Fixed crash when attempting to group by enabled state and mods are being actively removed. ([#16609](https://github.com/Nexus-Mods/Vortex/issues/16609))
- Fixed exception when attempting to see if the user is logged in. ([#16600](https://github.com/Nexus-Mods/Vortex/issues/16600))
- **api**: Updated libloot to 0.24.5
- **api**: Fixed several issues with version coercion in the bepinex extension. ([#16626](https://github.com/Nexus-Mods/Vortex/issues/16626))
- **witcher3**: Fixed minor issues caused by case sensitive checks

## [1.13.0-beta.4] - 2024-10-22

- Fixed failed profile switch when managing game using symlinks
- Fixed download notification spamming the UI during collection install
- Fixes GameId/domainName reverse conversion not catering for multiple compatible games
- Improved Vortex corruption error message. ([#16591](https://github.com/Nexus-Mods/Vortex/issues/16591))
- Fixes semantic coercion with leading zeroes
- Fixed semver bug when whitespace in mod versions
- Fixed promise chain when applying ini tweaks for Gamebryo games
- **7daystodie**: Fixed UDF dialog being raised incorrectly
- **collections**: Fixed collapsed mods tab table
- **bepinex**: Fixed installation error when installing BepInEx 6.0. ([#16587](https://github.com/Nexus-Mods/Vortex/issues/16587), [#15933](https://github.com/Nexus-Mods/Vortex/issues/15933))
- **bepinex**: Fixed issues with BepInEx's mod entry update.

## [1.13.0-beta.3] - 2024-10-14

- Fixed incorrect fallback mod update selection
- Fixed updater ignoring pre-release tag
- Adding alternative game domains to future-proof API changes

## [1.13.0-beta.2] - 2024-10-09

- Fixed UpdateSet initializing for non-FBLO games. ([#16544](https://github.com/Nexus-Mods/Vortex/issues/16544), [#16545](https://github.com/Nexus-Mods/Vortex/issues/16545))
- Fixed checkboxes not rendering on load order entries.

## [1.13.0-beta.1] - 2024-10-01

- Fixed exception when unmanaging (some) community game extensions. ([#16507](https://github.com/Nexus-Mods/Vortex/issues/16507), [#16372](https://github.com/Nexus-Mods/Vortex/issues/16372))
- Fixed attempts to import local downloads when no game is active. ([#16363](https://github.com/Nexus-Mods/Vortex/issues/16363))
- Improved checks for mod updates. ([#16453](https://github.com/Nexus-Mods/Vortex/issues/16453))
- Resolve mod installation profile query (if only 1 available). ([#16438](https://github.com/Nexus-Mods/Vortex/issues/16438))
- Added multi-select drag-and-drop to file-based load order.
- Added direct index typing to file-based load order.
- Added ability to modify the index of a load order entry using keyboard (click on index and modify it)
- Added ability to run up to 3 dependency installers in parallel
- Added FNV sanity checks extension as a requirement for Fallout New Vegas
- Removed redundant check when generating extended items.
- Fixed/Removed redundant deployment events during collection installation.
- Fixed inability to install non-extensions from site domain. ([#16481](https://github.com/Nexus-Mods/Vortex/issues/16481))
- Fixed file-based load order update set not initializing correctly.
- Fixed manual deployment actions not recognized correctly.
- Fixed manual file override assignment if/when mod has multiple matching file base names.
- Fixed FBLO spamming log information for games that do not use that component (e.g. Skyrim).
- Fixed redundant file override logic execution when nothing had changed.
- Fixed FOLON/FO4 mixed collection issue. ([#16305](https://github.com/Nexus-Mods/Vortex/issues/16305))
- Less generic error for rate limit breaches.
- Added ability to disable the experimental move deployment method through the game registration call. ([#16200](https://github.com/Nexus-Mods/Vortex/issues/16200))
- Fixed premature fileName reference comparison failure during collection install
- **api**: Added coreceVersion as an API utility function ([#16304](https://github.com/Nexus-Mods/Vortex/issues/16304))
- **api**: (Deprecated) libxmljs is no longer exported as part of Vortex's API.
- **api**: Fixed load order entries losing their index on mod update/re-install. ([#16086](https://github.com/Nexus-Mods/Vortex/issues/16086))
- **collections**: Fixed crash when switching profiles in the collection install dialog. ([#16242](https://github.com/Nexus-Mods/Vortex/issues/16242))
- **collections**: Now uses improved coercion to better support dependency detection
- **collections**: Added context menu action to apply collection rules manually
- **mod-dependency-manager**: No longer trim the versions of the mods to 3 digits
- **modtype-bepinex**: Improved error handling for when no matching bepinex pack is found. ([#15933](https://github.com/Nexus-Mods/Vortex/issues/15933))
- **baldursgate3**: Fix to support Patch 7 load order format. ([#16384](https://github.com/Nexus-Mods/Vortex/issues/16384))
- **witcher3**: Fixed incorrect mod type assignment for certain mods
- **masterchiefcollection**: Reduced mod depth to better support the new mod type

## [1.12.6] - 2024-10-02

- Fixed Starfield CC plugins being detected as native
- **baldursgate3:** Load order will now serialize to exactly match IGMM `modsettings.lsx` format.

## [1.12.5] - 2024-09-30

- Fixed mod enable notification not appearing
- **7daystodie**: Fixed UDF error when directory contains whitespace. ([16445](https://github.com/Nexus-Mods/Vortex/issues/16445))
- **plugin-management**: Added Starfield: Shattered Space plugin to native list
- **plugin-management**: Added ability to resolve native plugins through Regex patterns.

## [1.12.4] - 2024-09-11

- **plugin-management:** Updated libloot to 0.23.1. ([16391](https://github.com/Nexus-Mods/Vortex/issues/16391)).

## [1.12.3] - 2024-08-19

- Fixed inability to update/download folon mods through collections. ([16267](https://github.com/Nexus-Mods/Vortex/issues/16267))
- Disallow error reports caused by faulty launchers in contributed extensions. ([16215](https://github.com/Nexus-Mods/Vortex/issues/16215), [16250](https://github.com/Nexus-Mods/Vortex/issues/16250))
- Fixed mods update error handling. ([16251](https://github.com/Nexus-Mods/Vortex/issues/16251))
- Fixed unsuccessful (statusCode 200) request error handling.
- **masterchiefcollection**: New mod format support. ([13745](https://github.com/Nexus-Mods/Vortex/issues/13745))

## [1.12.2] - 2024-08-14

- Fixed crash when comparing objects with skippable properties. ([#16234](https://github.com/Nexus-Mods/Vortex/issues/16234))
- Fixed inability to update mods that are tagged as compatibleDownloads. ([#16231](https://github.com/Nexus-Mods/Vortex/issues/16231))
- Fixed downloads/installation stalling when Vortex is in background.
- **plugin-management**: Removed non-relevant loot messages from inlined view

## [1.12.1] - 2024-08-12

- Fixed extension installation not executing from downloads page. ([#16197](https://github.com/Nexus-Mods/Vortex/issues/16197))
- Fixed inability to download from mega.nz as part of collection. ([#16176](https://github.com/Nexus-Mods/Vortex/issues/16176))
- **plugin-management**: Improved error handling for lootAsync api calls. ([#16181](https://github.com/Nexus-Mods/Vortex/issues/16181))
- **plugin-management**: Fixed inability to filter loot messages by "relevant messages"
- **mod-dependency-manager**: Swapped default dependency icon drag actions to "after" to aid UX

## [1.12.0] - 2024-08-06

_Stable release based on [1.12.0-beta.5]_

- Set Inter as new default font to align with site design system
- Added Mods of the Month to Dashboard. ([#15930](https://github.com/Nexus-Mods/Vortex/issues/15930))
- Fixed build issues with node 18.20 and above. ([#15950](https://github.com/Nexus-Mods/Vortex/issues/15950))
- Fixed inability to download files from Google Drive. ([#15893](https://github.com/Nexus-Mods/Vortex/issues/15893))
- Fixed redundant mod metadata lookup. ([#15934](https://github.com/Nexus-Mods/Vortex/issues/15934))
- Fixed error when attempting to untrack mods. ([#15935](https://github.com/Nexus-Mods/Vortex/issues/15935))
- Fixed symlink elevation scripts for Node.
- Fixed overrides ignored when deploying single mods. ([#15917](https://github.com/Nexus-Mods/Vortex/issues/15917))
- Fixed deployment flag not set when purging/deploying. ([#15925](https://github.com/Nexus-Mods/Vortex/issues/15925))
- Added extension version to the global error context. ([#15833](https://github.com/Nexus-Mods/Vortex/issues/15833))
- Added ability to select game store when manually choosing game folder. ([#15371](https://github.com/Nexus-Mods/Vortex/issues/15371))
- Fixes broken Xbox launcher for Pillars of Eternity 2. ([#15409](https://github.com/Nexus-Mods/Vortex/issues/15409))
- Adding support for EnderalSE on GOG. ([#15369](https://github.com/Nexus-Mods/Vortex/issues/15369))
- Added status pill to collection overview.
- Fixes warning when potentially downgrading.
- Changed how community game extensions are highlighted.
- Fixes potential crash when queryPath functor returns function. ([#15648](https://github.com/Nexus-Mods/Vortex/issues/15648))
- Added stricter diff check on skippable properties. ([#15721](https://github.com/Nexus-Mods/Vortex/issues/15721))
- Fixes crash when attempting to untrack (untracked) mods. ([#15801](https://github.com/Nexus-Mods/Vortex/issues/15801))
- Fixes error being missing if dotnet check fails
- libxmljs is being deprecated in 1.13
- Fixes excessive logging when testing mod references. ([#15884](https://github.com/Nexus-Mods/Vortex/issues/15884))
- Fixed deploy event on batch install/re-install. ([#16109](https://github.com/Nexus-Mods/Vortex/issues/16109))
- **api**: IRemoveModOptions is now being exported as part of the API
- **collections**: Added stricter collection checks before refreshing. ([#15414](https://github.com/Nexus-Mods/Vortex/issues/15414))
- **collections**: Fixed crash if mods/downloads become unavailable. ([#15979](https://github.com/Nexus-Mods/Vortex/issues/15979))
- **gamebryo**: Updates to better support Starfield. ([#15918](https://github.com/Nexus-Mods/Vortex/issues/15918))
- **plugin-management**: Improve UI\UX for LOOT-enabled games. ([#15929 ](https://github.com/Nexus-Mods/Vortex/issues/15929))
- **plugin-management:** Updated libloot to 0.23
- **plugin-management:** Fixed inability to sort through FBLO for Starfield
- **plugin-management:** Fixed plugin list not being updated on startup
- **plugin-management:** Fixed incorrect missing masters notification when using fblo
- **plugin-management**: Fixed parsing of light plugins for non-Starfield gamebryo games
- **baldursgate3**: Fixed LSLib not executing with whitespace in path. ([#15679](https://github.com/Nexus-Mods/Vortex/issues/15679))
- **baldursgate3:** Fixed inability to deserialize manually added mod entries. ([#16106](https://github.com/Nexus-Mods/Vortex/issues/16106))
- **bannerlord**: Game support has been moved to a new [community extension](https://www.nexusmods.com/site/mods/875) by [Aragas](https://github.com/Aragas) and the [BUTR team](https://github.com/BUTR). ([#15436](https://github.com/Nexus-Mods/Vortex/issues/15436))
- **bladeandsorcery**: Removed legacy mod support. ([#16000](https://github.com/Nexus-Mods/Vortex/issues/16000))
- **fallout4:** Adding Fallout: London game domain support
- **witcher3**: Fixed crash if user has insufficient permissions. ([#15793](https://github.com/Nexus-Mods/Vortex/issues/15793))
- **witcher3:** Fixed DLC entries displayed on Load Order page

## [1.12.0-beta.5] - 2024-07-29

- Fixed deploy event on batch install/re-install. ([#16109](https://github.com/Nexus-Mods/Vortex/issues/16109))
- **plugin-management:** Fixed inability to sort through FBLO for Starfield
- **baldursgate3:** Fixed inability to deserialize manually added mod entries. ([#16106](https://github.com/Nexus-Mods/Vortex/issues/16106))
- **fallout4:** Adding Fallout: London game domain support

## [1.12.0-beta.4] - 2024-07-24

- **plugin-management:** Fixed plugin list not being updated on startup

## [1.12.0-beta.3] - 2024-07-22

- **plugin-management:** Fixed incorrect missing masters notification when using fblo

## [1.12.0-beta.2] - 2024-07-17

- Removed old hardcoded font names
- **plugin-management**: Fixed parsing of light plugins for non-Starfield gamebryo games

## [1.12.0-beta.1] - 2024-07-16

- Set Inter as new default font to align with site design system
- Added Mods of the Month to Dashboard. ([#15930](https://github.com/Nexus-Mods/Vortex/issues/15930))
- Fixed build issues with node 18.20 and above. ([#15950](https://github.com/Nexus-Mods/Vortex/issues/15950))
- Fixed inability to download files from Google Drive. ([#15893](https://github.com/Nexus-Mods/Vortex/issues/15893))
- Fixed redundant mod metadata lookup. ([#15934](https://github.com/Nexus-Mods/Vortex/issues/15934))
- Fixed error when attempting to untrack mods. ([#15935](https://github.com/Nexus-Mods/Vortex/issues/15935))
- Fixed symlink elevation scripts for Node.
- Fixed overrides ignored when deploying single mods. ([#15917](https://github.com/Nexus-Mods/Vortex/issues/15917))
- Fixed deployment flag not set when purging/deploying. ([#15925](https://github.com/Nexus-Mods/Vortex/issues/15925))
- Added extension version to the global error context. ([#15833](https://github.com/Nexus-Mods/Vortex/issues/15833))
- Added ability to select game store when manually choosing game folder. ([#15371](https://github.com/Nexus-Mods/Vortex/issues/15371))
- Fixes broken Xbox launcher for Pillars of Eternity 2. ([#15409](https://github.com/Nexus-Mods/Vortex/issues/15409))
- Adding support for EnderalSE on GOG. ([#15369](https://github.com/Nexus-Mods/Vortex/issues/15369))
- Added status pill to collection overview.
- Fixes warning when potentially downgrading.
- Changed how community game extensions are highlighted.
- Fixes potential crash when queryPath functor returns function. ([#15648](https://github.com/Nexus-Mods/Vortex/issues/15648))
- Added stricter diff check on skippable properties. ([#15721](https://github.com/Nexus-Mods/Vortex/issues/15721))
- Fixes crash when attempting to untrack (untracked) mods. ([#15801](https://github.com/Nexus-Mods/Vortex/issues/15801))
- Fixes error being missing if dotnet check fails
- libxmljs is being deprecated in 1.13
- Fixes excessive logging when testing mod references. ([#15884](https://github.com/Nexus-Mods/Vortex/issues/15884))
- **gamebryo**: Updates to better support Starfield. ([#15918](https://github.com/Nexus-Mods/Vortex/issues/15918))
- **api**: IRemoveModOptions is now being exported as part of the API
- **baldursgate3**: Fixed LSLib not executing with whitespace in path. ([#15679](https://github.com/Nexus-Mods/Vortex/issues/15679))
- **bannerlord**: Game support has been moved to a new [community extension](https://www.nexusmods.com/site/mods/875) by [Aragas](https://github.com/Aragas) and the [BUTR team](https://github.com/BUTR). ([#15436](https://github.com/Nexus-Mods/Vortex/issues/15436))
- **bladeandsorcery**: Removed legacy mod support. ([#16000](https://github.com/Nexus-Mods/Vortex/issues/16000))
- **witcher3**: Fixed crash if user has insufficient permissions. ([#15793](https://github.com/Nexus-Mods/Vortex/issues/15793))
- **collections**: Added stricter collection checks before refreshing. ([#15414](https://github.com/Nexus-Mods/Vortex/issues/15414))
- **collections**: Fixed crash if mods/downloads become unavailable. ([#15979](https://github.com/Nexus-Mods/Vortex/issues/15979))
- **plugin-management**: Improve UI\UX for LOOT-enabled games. ([#15929 ](https://github.com/Nexus-Mods/Vortex/issues/15929))

## [1.11.7] - 2024-06-11

- Fixed excessive logging when downloading collections. ([#15883](https://github.com/Nexus-Mods/Vortex/issues/15883))
- **modtype-bepinex**: Fixed installation error for BepInEX 5.4.23 or higher. ([#15670](https://github.com/Nexus-Mods/Vortex/issues/15670))
- **mod-dependencies**: Added workaround setting for disabling modtype conflicts.
- **witcher3**: Fixed installer for mixed mods (both dlc and regular).

## [1.11.6] - 2024-05-22

- **collections**: Fixed dependency installation errors if no extra metadata available. ([#15746](https://github.com/Nexus-Mods/Vortex/issues/15746))
- **witcher3**: fixed error when raising script merger notification. ([#15743](https://github.com/Nexus-Mods/Vortex/issues/15743))

## [1.11.5] - 2024-05-21

- **collections**: Fixed installer options of mods with changed FOMOD structures not publishing correctly. ([#15679](https://github.com/Nexus-Mods/Vortex/issues/15679))
- **collections**: Added status pill to collection overview
- **witcher3**: Added Epic Game Store discovery. ([#15362](https://github.com/Nexus-Mods/Vortex/issues/15362))
- **witcher3**: Version information now displaying correctly
- **witcher3**: Migrated load ordering system to use new FBLO API. ([#15362](https://github.com/Nexus-Mods/Vortex/issues/15362))
- **witcher3**: Bug fixes and code cleanup

## [1.11.4] - 2024-05-14

- **collections**: Fixed re-install dialog showing when installing in unattended mode.
- **baldursgate3**: Fixed LSLib not executing with whitespace in path. ([#15679](https://github.com/Nexus-Mods/Vortex/issues/15679))

## [1.11.3] - 2024-05-13

_Stable release based on [1.11.2-beta]._

- Fixed re-render issue when enabling/disabling mod entries in the file-based load order
- libloot updated to 0.22.4
- Add support for Fallout 4 on Epic ([#15580](https://github.com/Nexus-Mods/Vortex/issues/15580))
- Add support for new BA2 archive headers in Gamebryo games
- New update workflow to better communicate What's New, minimize auto downloading (unless critical hotfixes) and more information when swapping update channels. ([#15363](https://github.com/Nexus-Mods/Vortex/issues/15363))
- **vortex-api**: Fixed performance degradation when downloading collections for games that use the file based load order system. ([#15395](https://github.com/Nexus-Mods/Vortex/issues/15395))
- **stardewvalley**: Fixed SMAPI update notification appearing while managing other games
- **collections**: Added comparison of patches, installer choices, hashes when installing. ([#15396](https://github.com/Nexus-Mods/Vortex/issues/15396))
- **collections**: Updated styles to fix update changelog bounds
- **collections**: Better logging when profile switching
- **collections**: Fixed rare crash where game version was being compared
- **collections**: Improved error handling when displaying instructions. ([#14570](https://github.com/Nexus-Mods/Vortex/issues/14570))
- **collections**: Instructions textarea now fills available space. ([#15394](https://github.com/Nexus-Mods/Vortex/issues/15394))
- **collections**: Override overflow now scrolls vertically.
- **modtype-bepinex**: Fixed download issues caused by package resolution applying the new archive format to 5.x.x versions of BepInEx
- **mod-dependencies**: Suppress error report when user cancels purge
- **mod-dependencies**: Fixed file overrides being cleared when switching to an empty profile
- **mod-dependencies**: Fixed rare issue where it was possible for mods to fail deploying certain types
- **plugin-management**: Fixed long delays when ascertaining if a plugin is marked light
- **baldursgate3**: Performance improvements when installing collections and using LSLib
- **baldursgate3**: Added caching to PAK reading
- **baldursgate3**: Added a better .NET error catch and shows a fix dialog. ([#15391](https://github.com/Nexus-Mods/Vortex/issues/15391))
- Restyled announcement dashlet
- Underscores in archive names no longer cause installation issues. ([#15334](https://github.com/Nexus-Mods/Vortex/issues/15334))
- Fixed layout issues with Contrast and Compact theme
- Added a Classic theme that uses the old colors
- Updated Logging format
- Updated dev bootstrap script
- Bump Electron from 25.8.4 to 28.2.0
- Bump Node from 18.15.0 to 18.18.2

## [1.11.2-beta] - 2024-05-07

- Hotfix for BA2 archive check
- Loot updated to 0.22.4

## [1.11.1-beta] - 2024-04-17

- (FBLO) Fixed re-render issue when enabling/disabling mod entries
- Loot updated to 0.22.3-14
- Fallout 4 now supported on Epic ([#15580](https://github.com/Nexus-Mods/Vortex/issues/15580))

## [1.11.0-beta] - 2024-04-02

- New update workflow to better communicate What's New, minimize auto downloading (unless critical hotfixes) and more information when swapping update channels. ([#15363](https://github.com/Nexus-Mods/Vortex/issues/15363))
- (API) Fixed performance degradation when downloading collections for games that use the file based load order system. ([#15395](https://github.com/Nexus-Mods/Vortex/issues/15395))
- (Stardew) Fixed SMAPI update notification appearing while managing other games
- (Collections) Added comparison of patches, installer choices, hashes when installing. ([#15396](https://github.com/Nexus-Mods/Vortex/issues/15396))
- (Collections) Updated styles to fix update changelog bounds
- (Collections) Better logging when profile switching
- (Collections) Fixed rare crash where game version was being compared
- (Collections) Improved error handling when displaying instructions. ([#14570](https://github.com/Nexus-Mods/Vortex/issues/14570))
- (Collections) Instructions textarea now fills available space. ([#15394](https://github.com/Nexus-Mods/Vortex/issues/15394))
- (Collections) Override overflow now scrolls vertically.
- (BepInEx) Fixed download issues caused by package resolution applying the new archive format to 5.x.x versions of BepInEx
- (Dependency Management) Suppress error report when user cancels purge
- (Dependency Management) Fixed file overrides being cleared when switching to an empty profile
- (Dependency Management) Fixed rare issue where it was possible for mods to fail deploying certain types
- (Plugin Management) Fixed long delays when ascertaining if a plugin is marked light
- (Baldur's Gate 3) Performance improvements when installing collections and using LSLib
- (Baldur's Gate 3) Added caching to PAK reading
- (Baldur's Gate 3) Added a better .NET error catch and shows a fix dialog. ([#15391](https://github.com/Nexus-Mods/Vortex/issues/15391))
- (Announcements) Restyled announcement dashlet
- (Mod Management) Underscores in archive names no longer cause installation issues. ([#15334](https://github.com/Nexus-Mods/Vortex/issues/15334))
- (Theme) Fixed layout issues with Contrast and Compact theme
- (Theme) Added a Classic theme that uses the old colors
- Updated Log format
- Updated dev bootstrap script
- Updated Electron and Node

## [1.10.8] - 2024-03-13

- Fixed error when accessing conflicts before conflict calculation completed
- Fixed another instance where redundant file overrides were _not_ being removed
- Fixed preview not working in override editor

## [1.10.7] - 2024-03-12

- Fixed redundant mods notification raised incorrectly
- Fixed redundant file override test removing entries incorrectly (or not removing them at all)
- Fixed manually created file overrides not saved upon restart
- Fixed purge event executed needlessly when no mod type conflicts are detected

## [1.10.6] - 2024-02-28

- Fixed inability to determine conflicts on startup (race condition)

## [1.10.5] - 2024-02-27

- Fixed erroneously attempting to add fileOverrides to a disabled mod
- Fixed attempts to iterate through invalid fileOverrides (causing the .includes error)

## [1.10.4] - 2024-02-26

- Fixed crash if fileOverrides are undefined for a mod instance

## 1.10.3 - 2024-02-21

_Yanked due to critical issue found with file overrides_

- Sorting algorithm is now memoized
- Fixed file overrides not applied/removed from all affected mods
- Fixed overrides being applied to all mods regardless of modType conflict
- Fixed overrides not being removed when mod is disabled
- Protection against writing non-strings to file override state
- Beta and version information now shown on toolbar

## [1.10.2] - 2024-02-19

- Fixed conflict editor rendering when game not discovered

## [1.10.1] - 2024-01-25

- Fixed styles throughout
- Fixed hanging renderer thread when executing inter-thread actions (#15185)
- (BG3) Fixed info.json conflicts

## [1.10.0] - 2024-01-24

- (Collections) Improved styles for button states
- (Collections) Improved version mismatch dialog
- (Collections) Improved collection health downvote dialog
- (Collections) Allow curator to recommend using new profile on collection install
- (Collections) 12-hour delay from installing to voting is now based on install being finished
- (Collections) Game Version displayed in health rating
- (Dependency Manager) Fixed file conflicts not being detected across modtypes
- Fixed styles on table multi row select
- Fixed sorting on Add Mods to Collection dialog
- Updated styles for modals
- (SkyVR) Fixed error when attempting to find EslEnabler
- (Xbox) Fixed crash when attempting to detect xbox manifests during game installation and/or when xbox game store did not clear the game folders correctly.
- .NET check fail has updated text to match Microsoft's naming scheme as well as more accurately reflect what is needed and why
- (Script Extender) Fixed premium download journey
- (Palworld) Game stub added
- (Gamebryo) Zlib updated to 1.3.1

## [1.9.13] - 2024-01-08

- (API) Enhanced FBLO extension to maintain load order on purge
- (Baldur's Gate 3) Fix for modfixer notification not able to be supressed
- Updated remote URLs for announcements, extensions and changelog
- Updated layout for dashlets
- Updated default theme colors
- Updated notification colors to increase text legibility
- Updated uninstall feedback URL

## [1.9.12] - 2023-12-14

- (BepInEx) Fixed unsafe attempt to query the existence of the BepInEx package
- (Plugin Management) Modified ESL support detection to support game extension defined predicates
- (X4) fixed installation error if mod info is missing
- (Skyrim VR) Adding ESL support using [SKSEVR plugin](https://www.nexusmods.com/skyrimspecialedition/mods/106712)

## [1.9.11] - 2023-12-07

### Added

- (API) Added Save File dialog

### Changed

- (Baldur's Gate 3) Load Order Export to File now uses System Save Dialog
- (BepInEx) Improved API support
- Updated libxmljs dependency

### Fixed

- (Xbox Gamestore) Fixed file system error dialog being raised for encrypted drives
- Drag handles correctly show on all draggable entries on the Load Order page

## [1.9.10] - 2023-11-22

### Added

- Support for future code signing certificate

### Changed

- Updated design and styles for load order pages.
- More detailed log data when updating

## [1.9.9] - 2023-11-20

### Added

- Added deep merge to Vortex API

### Fixed

- Fixed crash when managing Game Pass games

## [1.9.8] - 2023-11-13

### Added

- (Cyberpunk 2077) Added as a game stub

### Changed

- Improved analytics (for those that have opted in)

### Fixed

- Fixed game discovery for XBox Game Pass games
- (Starfield) Fixed crash when attempting to create directory junction

## [1.9.7] - 2023-10-26

### Added

- (Starfield) Added as a game stub

### Changed

- Bump babel/traverse to 7.23.2
- (Baldur's Gate 3) Bumped to 1.3.7

### Fixed

- Fix for CLI args crashing Vortex on startup

## [1.9.6] - 2023-10-12

### Changed

- Bump electron to 25.8.4
- Bump postcss to 8.4.31
- Update 7zip to 23.01
- Updated masterlist revision for LOOT to 0.22.1

## [1.9.5] - 2023-09-25

### Changed

- Bump Electron from 25.3.1 to 25.8.1

### Fixed

- More consistent refreshing of OAuth tokens

## [1.9.4] - 2023-08-30

### Added

- (Fallout 4) Support for GOTY edition on GOG
- (7 Days to Die) Support for Version 2 of ModInfo.xml

### Changed

- (Stardew Valley) Removal of recommendations
- Clearer error messages for startup problems and crashes
- Game thumbnails scale better on Games page

### Fixed

- OAuth token refreshing causing 401 errors
- (Baldur's Gate 3) Support for full release

## [1.9.3] - 2023-07-31

### Added

- Packaged builds now created on CI

### Changed

- Updated Electron to 25.3.0

### Fixed

- Tweaks to reduce OAuth errors

## [1.9.2] - 2023-07-20

### Fixed

- User info endpoint checks

## [1.9.1] - 2023-07-13

### Changed

- More information when handling 401/403 errors

## [1.9.0] - 2023-07-12

### Added

- New splash image to match branding
- Pill to show membership status next to name
- Changed default games order to 'Most Popular'

### Changed

- Replaced some older spinner icons
- Rewording of Edit Collections help text
- Reworded some error messages when installing dependencies and collections

### Fixed

- Some game extensions had incorrectly scaled background images
- About page changelog was showing raw markdown
- Incorrect revision number shown on collection thumbnail when updating
- OAuth scopes updated

## [1.8.5] - 2023-06-05

### Added

- Branded installer (custom installer only)
- Font rendering improved and all font weights are now supported

### Changed

- More robust check if VC++ Runtime is installed
- Updated site links for new campaign tracking
- Performance optimisations

### Fixed

- (Witcher 3) don't report user cancellation as error
- (Blade & Sorcery) fixed 0.2.12 migration'
- When providing feedback, users are treated as logged out if using OAuth
- Changelog dashlet was incorrectly displaying markdown

[2.0.1]: https://github.com/Nexus-Mods/Vortex/releases/tag/2.0.1
[2.0.0]: https://github.com/Nexus-Mods/Vortex/releases/tag/2.0.0
[2.0.0-beta.2]: https://github.com/Nexus-Mods/Vortex/releases/tag/2.0.0-beta.2
[2.0.0-beta.1]: https://github.com/Nexus-Mods/Vortex/releases/tag/v2.0.0-beta.1
[2.0.0-alpha.4]: https://github.com/Nexus-Mods/Vortex/releases/tag/v2.0.0-alpha.4
[2.0.0-alpha.3]: https://github.com/Nexus-Mods/Vortex/releases/tag/v2.0.0-alpha.3
[2.0.0-alpha.2]: https://github.com/Nexus-Mods/Vortex/releases/tag/v2.0.0-alpha.2
[2.0.0-alpha.1]: https://github.com/Nexus-Mods/Vortex/releases/tag/v2.0.0-alpha.1
[1.16.9]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.16.9
[1.16.8]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.16.8
[1.16.7]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.16.7
[1.16.6]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.16.6
[1.16.5]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.16.5
[1.16.4]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.16.4
[1.16.3]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.16.3
[1.16.2]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.16.2
[1.16.1]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.16.1
[1.16.0-beta.5]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.16.1-beta.5
[1.16.0-beta.4]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.16.1-beta.4
[1.16.0-beta.3]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.16.1-beta.3
[1.16.0-beta.2]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.16.1-beta.2
[1.16.0-beta.1]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.16.0-beta.1
[1.16.0-alpha.6]: https://github.com/Nexus-Mods/Vortex-Staging/releases/tag/v1.16.0-alpha.6
[1.16.0-alpha.5]: https://github.com/Nexus-Mods/Vortex-Staging/releases/tag/v1.16.0-alpha.5
[1.16.0-alpha.4]: https://github.com/Nexus-Mods/Vortex-Staging/releases/tag/v1.16.0-alpha.4
[1.16.0-alpha.3]: https://github.com/Nexus-Mods/Vortex-Staging/releases/tag/v1.16.0-alpha.3
[1.16.0-alpha.2]: https://github.com/Nexus-Mods/Vortex-Staging/releases/tag/v1.16.0-alpha.2
[1.15.2]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.15.2
[1.15.1]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.15.1
[1.14.0-beta.4]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.14.0-beta.4
[1.14.0-beta.3]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.14.0-beta.3
[1.14.0-beta.2]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.14.0-beta.2
[1.14.0-beta.1]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.14.0-beta.1
[1.13.7]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.13.7
[1.13.6]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.13.6
[1.13.5]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.13.5
[1.13.3]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.13.3
[1.13.2]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.13.2
[1.13.1]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.13.1
[1.13.0-beta.7]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.13.0-beta.7
[1.13.0-beta.6]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.13.0-beta.6
[1.13.0-beta.5]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.13.0-beta.5
[1.13.0-beta.4]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.13.0-beta.4
[1.13.0-beta.3]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.13.0-beta.3
[1.13.0-beta.2]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.13.0-beta.2
[1.13.0-beta.1]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.13.0-beta.1
[1.12.6]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.12.6
[1.12.5]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.12.5
[1.12.4]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.12.4
[1.12.3]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.12.3
[1.12.2]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.12.2
[1.12.1]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.12.1
[1.12.0]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.12.0
[1.12.0-beta.5]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.12.0-beta.5
[1.12.0-beta.4]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.12.0-beta.4
[1.12.0-beta.3]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.12.0-beta.3
[1.12.0-beta.2]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.12.0-beta.2
[1.12.0-beta.1]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.12.0-beta.1
[1.11.7]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.11.7
[1.11.6]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.11.6
[1.11.5]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.11.5
[1.11.4]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.11.4
[1.11.3]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.11.3
[1.11.2-beta]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.11.2-beta
[1.11.1-beta]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.11.1-beta
[1.11.0-beta]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.11.0-beta
[1.10.8]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.10.8
[1.10.7]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.10.7
[1.10.6]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.10.6
[1.10.5]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.10.5
[1.10.4]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.10.4
[1.10.2]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.10.2
[1.10.1]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.10.1
[1.10.0]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.10.2
[1.9.13]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.9.13
[1.9.12]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.9.12
[1.9.11]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.9.11
[1.9.10]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.9.10
[1.9.9]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.9.9
[1.9.8]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.9.8
[1.9.7]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.9.7
[1.9.6]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.9.6
[1.9.5]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.9.5
[1.9.4]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.9.4
[1.9.3]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.9.3
[1.9.2]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.9.2
[1.9.1]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.9.1
[1.9.0]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.9.0
[1.8.5]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.8.5
