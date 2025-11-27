# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## [0.3.13] - 2024-05-20

- fixed game support data synchronization between the main and renderer threads.
- fixed missing masterlist when sorting through API call.
- now supports dynamic plugins.txt file path.
- updated masterlist to revision 0.26

## [0.3.11] - 2024-12-23

- fixed plugin page displaying overriden mod as source

## [0.3.10] - 2024-10-02

- fixed Starfield CC plugins erroneously highlighted as "native" plugins

## [0.3.9] - 2024-10-01

- Added ability to resolve a game's native plugins based on regular expressions.

## [0.3.8] - 2024-09-10

- libloot updated to 0.23.1

## [0.3.7] - 2024-08-07

- Non-relevant LOOT messages are no longer shown in the inlined view

## [0.3.6] - 2024-08-07

- Fixed inability to filter by _relevant_ loot messages on the plugins page
- Improved error handling when sorting through FBLO

## [0.3.5] - 2024-08-06

- Fixed inability to sort via LOOT through the FBLO component (Starfield only)

## [0.3.4] - 2024-07-24
- Fixed plugins page update being blocked on startup (if no mod activity has been recorded yet)

## [0.3.0] - 2024-06-20

- Added a plugin counter "badge" to the plugins page button for when new plugins
  are added as part of a mod installation.
- Added informational popover to explain how LOOT works.
- Added LOOT message for plugins which are not present in the masterlist

## [0.2.9] - 2024-03-14

- Fixed long delays when ascertaining if a plugin is marked light

## [0.2.8] - 2023-12-18

- Modified ESL support detection to support game extension defined predicates
