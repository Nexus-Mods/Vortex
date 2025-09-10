# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Common Changelog](https://common-changelog.org/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.15.1 - 2025-09-10

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
- Fixed another instance where redundant file overrides were *not* being removed
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
- (Blade & Sorcery) fixed 0.2.12 migration
- When providing feedback, users are treated as logged out if using OAuth
- Changelog dashlet was incorrectly displaying markdown

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

