# Changelog Entry for v1.16.0-alpha.3

## [1.16.0-alpha.3] - 2025-11-05

_Stability-focused release with FOMOD native port completion, collection browsing improvements, and critical crash fixes_

### What's New

This alpha release focuses on stability, reliability, and completing the FOMOD native port.

**🔧 FOMOD Installer Native Overhaul**
- Complete architectural refactor for better performance and reliability
- Each installation gets its own native instance for improved isolation
- Significantly more reliable FOMOD installations in collections

**📚 Collection Improvements**
- Better browsing UX
- Fixed phase deployment and cancellation issues

**🛡️ Critical Fixes**
- Fixed Mixpanel crash when installing external mods
- Fixed download cleanup leaving corrupted files
- Fixed false positive warnings and buffer overflow bugs

**🔐 Security & Quality of Life**
- Warning dialogs for mods with C# scripts
- Better file type detection and automatic temp file cleanup

### Known Issues

- **YouTube embedded player:** Video playback not working when accessed from some regions

### Full Changelog

- Complete FOMOD Installer Native Port - Split FOMOD installer into shared logic and native implementation modules for better performance, reliability, and maintainability ([#18465](https://github.com/Nexus-Mods/Vortex/issues/18465))
- Collection browsing UX fixes ([#18728](https://github.com/Nexus-Mods/Vortex/issues/18728))
- Fixed Mixpanel event crash on mod install ([#18716](https://github.com/Nexus-Mods/Vortex/issues/18716))
- Fixed downloads folder cleanup ([#18720](https://github.com/Nexus-Mods/Vortex/issues/18720))
- Fixed download reference false positives for fuzzy/bundled mods ([#18719](https://github.com/Nexus-Mods/Vortex/issues/18719))
- Added C# script execution warning ([#18667](https://github.com/Nexus-Mods/Vortex/issues/18667))

[1.16.0-alpha.3]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.16.0-alpha.3
