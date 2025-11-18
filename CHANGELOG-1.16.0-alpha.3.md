# Changelog Entry for v1.16.0-alpha.3

## [1.16.0-alpha.3] - 2025-11-18

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

None reported for this release.

### Full Changelog

- Complete FOMOD Installer Native Port - Split FOMOD installer into shared logic and native implementation modules for better performance, reliability, and maintainability ([#18465](https://github.com/Nexus-Mods/Vortex/issues/18465))
- Collection browsing UX fixes ([#18728](https://github.com/Nexus-Mods/Vortex/issues/18728))
- Fixed collection browsing not scrolling back to top on pagination change ([#18726](https://github.com/Nexus-Mods/Vortex/issues/18726))
- Fixed installation skip of manually downloaded mods that are missing the referenceTag when installing a collection ([#18736](https://github.com/Nexus-Mods/Vortex/issues/18736))
- Fixed ability to export "dead" collection rules when uploading a new revision ([#18709](https://github.com/Nexus-Mods/Vortex/issues/18709))
- Fixed Mixpanel event crash on mod install ([#18716](https://github.com/Nexus-Mods/Vortex/issues/18716))
- Fixed downloads folder cleanup ([#18720](https://github.com/Nexus-Mods/Vortex/issues/18720))
- Fixed download reference false positives for fuzzy/bundled mods ([#18719](https://github.com/Nexus-Mods/Vortex/issues/18719))
- Fixed Game Not Supported Error when downloading a requirement from another game domain ([#18738](https://github.com/Nexus-Mods/Vortex/issues/18738))
- Fixed text in dialogue not displaying properly ([#18768](https://github.com/Nexus-Mods/Vortex/issues/18768))
- Fixed crash: HTTP (403) - Forbidden ([#18764](https://github.com/Nexus-Mods/Vortex/issues/18764))
- Fixed YouTube embedded player sometimes not working ([#18707](https://github.com/Nexus-Mods/Vortex/issues/18707))
- Fixed i18 functionality for string resources ([#18641](https://github.com/Nexus-Mods/Vortex/issues/18641))

[1.16.0-alpha.3]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.16.0-alpha.3
