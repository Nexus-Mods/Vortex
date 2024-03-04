# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.11.0] - 2024-xx-xx

- Updated Electron and Node
- (Stardew) Fixed SMAPI update notification appearing while managing other games
- (Collections) Added comparison of patches, installer choices, hashes when installing
- (BepInEx) Fixed download issues caused by package resolution applying the new archive format to 5.X.X versions of BepInEx
- (Dependency Managment) Suppress error report when user cancels purge
- Updated build script

## [1.10.6] - 2024-02-28

- Fixed inability to determine conflicts on startup (race condition)

## [1.10.5] - 2024-02-27

- Fixed erroneously attempting to add fileOverrides to a disabled mod
- Fixed attempts to iterate through invalid fileOverrides (causing the .includes error)

## [1.10.4] - 2024-02-26

- Fixed crash if fileOverrides are undefined for a mod instance

## [1.10.3] - 2024-02-21

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
