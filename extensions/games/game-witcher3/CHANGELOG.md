# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.12]
- Further fixes for .settings file merging
- (XML merging) - Added functionality to allow the user to decide whether to use the mod's
  xml if the native file is missing.

## [1.6.11]
- Added dx12user.settings merging capability (using the .part.txt suffix pattern)
- Fixed TL mod type not assigned when installing binary mods.
- Fixed collection data view not displaying exported load order entries.
- Fixed merged menu mods raising the external changes dialog when nothing changed.
- Modernised and improved XML configuration merging (all native .xml files are now mergeable)

## [1.6.10]
- Fixed inability to separate load order entries that are distributed by the same mod.

## [1.6.9]

- Fixed case sensitivity when installing mods with input.xml data
- Fixed case sensitivity when installing dlc mods

## [1.6.8]

- Fixed issue where some mods were not being assigned the correct mod type.

## [1.6.7]

- Added user friendly names to the load order entries.

## [1.6.5-6]

- Removed dlc load order entries.

## [1.6.4] - 2024-06-12

- Fixed incorrect detection of load order entry names for mixed mods

## [1.6.3] - 2024-06-11

- Fixed the installer for mixed mods not executing (been broken for a while)
- Fixed mod installation for mods that provide both dlc and mods folders and do not contain menu mod information.

## [1.6.2] - 2024-05-29

- Fixed crash when attempting to create load order file, and user has insufficient permissions

## [1.6.1] - 2024-05-22

- Fixed crash when attempting to raise the "Missing Script Merger" notification

## [1.6.0] - 2024-05-21

- Added Epic Game Store discovery
- Added context menu item in Mods page to allow users to import LO and script merge data when right clicking the mod entry.
- Added custom item renderer to view source mods of load order entries
- Fixed longstanding issue causing the menu mod to fail deployment when imported from a collection
- Version information now displaying correctly
- Removed mod limit patcher (no longer needed)
- Migrated load ordering system to use new FBLO API
- Bug fixes and code cleanup

## [1.5.3] - 2022-12-14

- Initial version