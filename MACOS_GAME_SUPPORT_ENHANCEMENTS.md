# macOS Game Support Enhancements

This document provides comprehensive documentation for all the enhancements made to improve game discovery and support on macOS, including support for Windows games running through various virtualization software.

## Overview

The enhancements include:
1. Enhanced virtualization detection utilities for Crossover, Parallels, VMware, and VirtualBox
2. Updates to existing game store implementations to support virtualized environments
3. Enhanced game store extensions to support macOS (Origin, Uplay)
4. Improved Mac App Store extension with better title detection
5. Updates to drive detection to include all virtualized environments

## Changes Made

### 1. Enhanced Virtualization Detection Utilities

**File:** `src/util/macVirtualization.ts`

Enhanced utilities to detect and interact with virtualization software:
- `getCrossoverPaths()` - Detects Crossover bottle paths
- `getParallelsPaths()` - Detects Parallels VM paths
- `getVMwarePaths()` - Detects VMware Fusion VM paths
- `getVirtualBoxPaths()` - Detects VirtualBox VM paths
- `getCrossoverWindowsDrives()` - Gets Windows drive paths from Crossover bottles
- `getParallelsWindowsDrives()` - Gets Windows drive paths from Parallels VMs
- `getVMwareWindowsDrives()` - Gets Windows drive paths from VMware VMs
- `getVirtualBoxWindowsDrives()` - Gets Windows drive paths from VirtualBox VMs
- `getAllWindowsDrivePaths()` - Gets all Windows-compatible drive paths including all virtualized environments

### 2. Platform Utilities Update

**File:** `src/util/platform.ts`

Added new function:
- `isMacOSWithVirtualization()` - Always returns true on macOS as virtualization support is available

### 3. Drive List Enhancement

**File:** `src/extensions/gamemode_management/util/getDriveList.ts`

Updated to use `getAllWindowsDrivePaths()` on macOS, which includes:
- Standard macOS drives
- Crossover bottle drives
- Parallels shared folders
- VMware shared folders
- VirtualBox shared folders
- Common external drive mount points

### 4. Steam Implementation Update

**File:** `src/util/Steam.ts`

Enhanced Steam path detection to include:
- Standard macOS Steam installation
- Steam installations in Crossover bottles
- Steam installations in VMware VMs
- Steam installations in VirtualBox VMs
- Future support for Parallels VMs

### 5. GOG Galaxy Implementation Update

**File:** `src/util/GOGGalaxy.ts`

Enhanced GOG Galaxy path detection to include:
- Standard macOS GOG Galaxy installation
- GOG Galaxy installations in Crossover bottles
- GOG Galaxy installations in VMware VMs
- GOG Galaxy installations in VirtualBox VMs

### 6. Epic Games Launcher Implementation Update

**File:** `src/util/EpicGamesLauncher.ts`

Enhanced Epic Games Launcher path detection to include:
- Standard macOS Epic Games Launcher installation
- Epic Games Launcher installations in Crossover bottles
- Epic Games Launcher installations in VMware VMs
- Epic Games Launcher installations in VirtualBox VMs

### 7. Origin Game Store Extension Enhancement

**Directory:** `extensions/gamestore-origin/`

Enhanced the Origin game store extension to support macOS:
- Added macOS-specific path detection
- Added support for Origin installations in Crossover bottles
- Removed Windows-only restriction
- Updated build configuration to allow building on macOS

### 8. Uplay Game Store Extension Enhancement

**Directory:** `extensions/gamestore-uplay/`

Enhanced the Uplay game store extension to support macOS:
- Added macOS-specific path detection
- Added support for Uplay installations in Crossover bottles
- Added support for VMware and VirtualBox virtualized environments
- Removed Windows-only restriction
- Updated build configuration to allow building on macOS

### 9. Xbox Game Store Extension Enhancement

**Directory:** `extensions/gamestore-xbox/`

Enhanced the Xbox game store extension to support macOS:
- Added basic support for macOS (though functionality is limited)
- Removed Windows-only restriction
- Updated build configuration to allow building on macOS

### 10. Mac App Store Extension Enhancement

**Directory:** `extensions/gamestore-macappstore/`

Enhanced the Mac App Store extension with better title detection:
- Uses macOS system APIs (`mdls`) for better app metadata detection
- Improved heuristics for identifying games
- Enhanced game name pattern matching

### 11. Build Configuration Updates

**File:** `BuildSubprojects.json`

Updated build configurations to allow building game store extensions on macOS:
- Removed Windows-only conditions for Origin, Uplay, and Xbox extensions

### 12. Test Creation

**File:** `__tests__/util.macVirtualization.test.js`

Enhanced unit tests for the virtualization detection utilities to include:
- VMware virtualization support
- VirtualBox virtualization support
- Proper path detection for all virtualization software

## Benefits

These enhancements provide the following benefits:

1. **Improved Game Discovery**: Vortex can now discover games installed in all major virtualization environments
2. **Better Windows Game Support**: Windows games running through Crossover, Parallels, VMware, or VirtualBox can be managed
3. **Mac App Store Integration**: Native Mac App Store games are now supported with better title detection
4. **Enhanced Drive Detection**: Game discovery now includes all virtualized drives
5. **Future-Proof**: The architecture allows for easy addition of other virtualization software
6. **Cross-Platform Compatibility**: Game store extensions now work on macOS where applicable

## Technical Details

### Virtualization Detection

The virtualization detection works by:
1. Checking for installed virtualization software (Crossover, Parallels, VMware, VirtualBox)
2. Locating virtual environments (Crossover bottles, VM files)
3. Mapping virtual drives to accessible paths
4. Including these paths in the game discovery process

### Game Store Enhancements

Existing game store implementations were enhanced to:
1. Check standard installation paths
2. Fall back to virtualized environment paths
3. Maintain backward compatibility
4. Provide detailed logging for debugging

### Mac App Store Extension

The enhanced extension:
1. Scans standard Mac App Store installation directories
2. Uses system APIs for better metadata detection
3. Uses improved heuristics to identify games
4. Integrates with the existing game store framework

## Testing

Unit tests were enhanced for the virtualization detection utilities to ensure:
1. Proper path detection for all virtualization software
2. Error handling
3. Cross-platform compatibility
4. Edge case handling

## Future Improvements

Potential future improvements include:
1. Integration with Mac App Store APIs for detailed game information
2. Support for additional virtualization software
3. Enhanced game launching capabilities
4. Improved game detection heuristics
5. Better integration with system APIs for more accurate detection
6. Support for more sophisticated metadata extraction from app bundles

## Compatibility

These changes maintain full backward compatibility with:
1. Existing game store implementations
2. Current game discovery processes
3. All supported platforms (Windows, macOS, Linux)
4. Existing user configurations

The enhancements only add new functionality without breaking existing features.

## Supported Virtualization Software

1. **Crossover**: CodeWeavers Crossover
2. **Parallels**: Parallels Desktop
3. **VMware**: VMware Fusion
4. **VirtualBox**: Oracle VirtualBox

## Supported Game Stores

1. **Steam**: Fully supported with virtualization
2. **GOG Galaxy**: Fully supported with virtualization
3. **Epic Games Launcher**: Fully supported with virtualization
4. **Origin**: Now supported on macOS with virtualization
5. **Uplay**: Now supported on macOS with virtualization
6. **Xbox**: Basic support on macOS (limited functionality)
7. **Mac App Store**: Enhanced support with better title detection

## Installation and Usage

No special installation steps are required. The enhancements are automatically available when running Vortex on macOS.

For games running in virtualized environments:
1. Ensure the virtualization software is properly installed
2. Install games in the virtualized environment as you normally would
3. Vortex will automatically detect and manage these games
4. Mod installation and management works the same as with native games

## Troubleshooting

If games in virtualized environments are not being detected:
1. Verify that the virtualization software is properly installed
2. Check that the virtual environment paths match the expected locations
3. Ensure that the virtualized games are properly installed
4. Restart Vortex to refresh game detection

For Mac App Store games not being detected:
1. Verify that the games are properly installed
2. Check that the game names match the expected patterns
3. Restart Vortex to refresh game detection