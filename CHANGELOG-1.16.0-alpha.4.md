# Changelog Entry for v1.16.0-alpha.4

## [1.16.0-alpha.4] - 2025-11-26

_Fallout series modding improvements and collection installation fixes_

### What's New

This alpha release focuses on improving the Fallout modding experience and fixing collection installation issues.

**🎮 Fallout New Vegas Modding Overhaul**
- Improved NVSE installation with SMAPI-style assisted download
- Automatic 4GB Patcher support for better game stability
- Integrated sanity checks for common configuration issues (as part of [Senjay](https://next.nexusmods.com/profile/Senjay)'s [Fallout New Vegas Sanity Checks](https://www.nexusmods.com/site/mods/945)
 extension)
- Archive invalidation now applies automatically (as part of [Senjay](https://next.nexusmods.com/profile/Senjay)'s [Fallout New Vegas Sanity Checks](https://www.nexusmods.com/site/mods/945) extension)

**📚 Collection Installation**
- Multiple fixes for mod attributes not applying correctly during collection install (types, categories, renames, presets)
- Fallout 4 Anniversary collection optional mods now install correctly
- "Do this for all remaining installs" button now works when reinstalling

**🛡️ Stability & Performance**
- Faster snapshot creation during Fallout 4 deployment
- Download chunk retry reliability improvements
- FOMOD installer crash fix

**🔧 Quality of Life**
- Removed unnecessary "Loose Files May Not Get Loaded" notification for Skyrim SE
- Collection browsing now uses collectionsV2 API with adult content preferences support

### Known Issues

When installing [Gopher's New Vegas Remaster](https://www.nexusmods.com/games/newvegas/collections/hss8nv) (and possibly others we haven't found yet), if the collection is installed and then the mods are removed (but downloads kept), the collection stalls when trying to resume. This can be fixed by pausing and resuming the collection install.  

### Full Changelog

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

[1.16.0-alpha.4]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.16.0-alpha.4
