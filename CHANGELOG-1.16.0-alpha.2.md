# Changelog Entry for v1.16.0-alpha.2

## [1.16.0-alpha.2] - 2025-10-29

_Major refactor release with Electron 37, .NET 9 upgrade, complete Download/Install pipeline overhaul, and new Collection Browsing feature_

### What's New

This alpha release brings massive performance improvements, a brand new collection browsing experience, and major reliability enhancements. Here's what you'll notice:

**🚀 Collections with Pre-Configured Mods Install Way Faster**
- Skipped unnecessary deployments between phases for mods with pre-saved installer choices
- Collections with many FOMODs now install 50-70% faster
- Phases still exist but deployments only happen when needed
- A collection that took 15 minutes now takes 5-6 minutes

**📚 Browse Collections Right in Vortex**
- New dedicated Collections Browser built into Vortex
- Browse, search, and filter collections without leaving the app
- See collection details, endorsements, and curator information
- One-click install directly from the browser
- Modern, responsive design with improved performance

**⚡ Even Faster Downloads & Installs**
- Downloads and installations now happen simultaneously instead of one at a time
- Up to 10 mods can download at once
- Automatic retry on failed downloads means fewer manual interventions
- 4x faster mod extraction when installing
- FOMOD installations in collections are significantly faster and more reliable

**🔧 Plugin Sorting Fixed**
- No more needing to restart Vortex after installing a collection to get plugins sorted correctly
- LOOT masterlist now updates properly on first run
- Autosort works reliably after collection installations

**🎮 Better User Experience**
- Fewer annoying notifications - many now appear as quick toasts that don't clutter your screen
- Notifications automatically clear when you switch games
- Download progress indicators are now accurate
- UI remains responsive even during heavy download/install activity

**✨ Quality of Life Improvements**
- Fixed collections not showing as complete when finished
- Fixed mod type conflicts during collection installation
- Collection editing now available for users with proper permissions
- Better feedback system with Google Form integration
- Large collections download in the background while you continue working

**⚙️ Under the Hood**
- Upgraded to latest Electron 37 and .NET 9 for better performance and security
- Improved analytics (for those who opt-in) to help us understand and fix issues faster
- Removed over 500 lines of complex phase management code

**⚠️ Important Notes**
- This is an **alpha release** - please report any issues you encounter
- If you use custom extensions, they may need updates to work with the new system

### Known Issues

- **YouTube embedded player:** Video playback not working when accessed from UK regions
- **FOMOD installer socket drops:** Interactive FOMOD installations may intermittently hang due to concurrent socket connection issues with modInstallerIPC.exe. If a collection stalls during installation, pause and resume to recover. This IPC component will be removed in the next alpha release
- **Redundant mods dialog:** Review link is non-functional
- **Collection mod rules:** Mod rules may fail to apply at completion of collection installation

### Full Changelog

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

[1.16.0-alpha.2]: https://github.com/Nexus-Mods/Vortex/releases/tag/v1.16.0-alpha.2
