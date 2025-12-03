# Changelog Entry for v1.16.0-alpha.5

## [1.16.0-alpha.5] - 2025-12-03

_Stability fixes and collection installation improvements_

### What's New

This alpha release focuses on stability improvements and fixing collection installation issues.

**🛡️ Stability & Bug Fixes**
- Fixed crash on startup when no game is active
- Fixed race condition causing mods to lack metadata during installation
- Fixed stalled collection installation when mod archives are present
- Fixed installer issue where certain files are not linked correctly

**⚡ Performance**
- FOMOD installer now lazy loads for faster startup

**🔧 Technical**
- Fixed handling of undefined game stores

### Known Issues

No known issues

### Full Changelog

- Fixed crash on startup when no game is active ([#18898](https://github.com/Nexus-Mods/Vortex/issues/18898))
- Fixed race condition causing mods to lack metadata during installation ([#18930](https://github.com/Nexus-Mods/Vortex/issues/18930))
- Fixed stalled collection installation when mod archives are present ([#18889](https://github.com/Nexus-Mods/Vortex/issues/18889))
- Fixed installer issue where certain files are not linked correctly ([#18927](https://github.com/Nexus-Mods/Vortex/issues/18927))
- FOMOD installer now lazy loads for faster startup ([#18868](https://github.com/Nexus-Mods/Vortex/pull/18868))
- Fixed handling of undefined game stores ([#18924](https://github.com/Nexus-Mods/Vortex/pull/18924))

[1.16.0-alpha.5]: https://github.com/Nexus-Mods/Vortex-Staging/releases/tag/v1.16.0-alpha.5