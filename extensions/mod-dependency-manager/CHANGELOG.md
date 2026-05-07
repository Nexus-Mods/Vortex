# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## [0.2.21] - 2025-03-10

- Fixed exception when unable to ascertain inverse rule type

## [0.2.20] - 2024-11-26

- Fixed attempts to render file override editor entries of mods that are being uninstalled in the background.

## [0.2.19] - 2024-08-20

- Improved rules/override suppression checks
- fixed inability to assign overrides in the override editor

## [0.2.18] - 2024-08-20

- Improved mod version coersion functionality to include pre-release information in generated rules.

## [0.2.17] - 2024-06-06

- Added setting to workarounds tab to allow users to disable modType conflict detection

## [0.2.16] - 2024-05-23

- Added some protective coding to block 3rd party extensions from setting invalid ignore lists
- Updated Webpack
- Fixed inability to assign different file providers

## [0.2.14] - 2024-03-21

- Fixed file overrides being cleared when switching to an empty profile
- Fixed rare issue where it was possible for mods to fail deploying certain types

## [0.2.13] - 2024-03-13

- Fixed error when accessing conflicts before conflict calculation completed
- Fixed another instance where redundant file overrides were _not_ being removed
- Fixed preview not working in override editor

## [0.2.12] - 2024-03-12

- Fixed redundant file override test removing entries incorrectly.
- Fixed pointless redundant file override state changes when nothing changed.
- Fixed manually created file overrides not saved upon restart.
- Fixed purge event executed needlessly when no mod type conflicts are detected.
