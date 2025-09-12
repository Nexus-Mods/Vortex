# Mac Game Support Enhancement Summary

This document summarizes the enhancements made to improve game discovery and support on macOS, including support for Windows games running through virtualization software.

## Overview

The enhancements include:
1. Creation of virtualization detection utilities for Crossover and Parallels
2. Updates to existing game store implementations to support virtualized environments
3. Creation of a new extension for Mac App Store game discovery
4. Updates to drive detection to include virtualized environments

## Changes Made

### 1. New Virtualization Detection Utilities

**File:** `src/util/macVirtualization.ts`

Created new utilities to detect and interact with virtualization software:
- `getCrossoverPaths()` - Detects Crossover bottle paths
- `getParallelsPaths()` - Detects Parallels VM paths
- `getCrossoverWindowsDrives()` - Gets Windows drive paths from Crossover bottles
- `getParallelsWindowsDrives()` - Gets Windows drive paths from Parallels VMs
- `getAllWindowsDrivePaths()` - Gets all Windows-compatible drive paths including virtualized environments

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
- Common external drive mount points

### 4. Steam Implementation Update

**File:** `src/util/Steam.ts`

Enhanced Steam path detection to include:
- Standard macOS Steam installation
- Steam installations in Crossover bottles
- Future support for Parallels VMs

### 5. GOG Galaxy Implementation Update

**File:** `src/util/GOGGalaxy.ts`

Enhanced GOG Galaxy path detection to include:
- Standard macOS GOG Galaxy installation
- GOG Galaxy installations in Crossover bottles

### 6. Epic Games Launcher Implementation Update

**File:** `src/util/EpicGamesLauncher.ts`

Enhanced Epic Games Launcher path detection to include:
- Standard macOS Epic Games Launcher installation
- Epic Games Launcher installations in Crossover bottles

### 7. New Mac App Store Extension

**Directory:** `extensions/gamestore-macappstore/`

Created a new extension to support Mac App Store game discovery:
- Detects games installed through the Mac App Store
- Scans both system and user Applications directories
- Uses heuristics to identify likely games
- Provides basic game launching functionality

**Files created:**
- `src/index.ts` - Main extension implementation
- `package.json` - Extension metadata and dependencies
- `tsconfig.json` - TypeScript configuration
- `webpack.config.js` - Build configuration
- `README.md` - Documentation

### 8. Build Configuration Update

**File:** `BuildSubprojects.json`

Added the new Mac App Store extension to the build configuration.

### 9. Test Creation

**File:** `__tests__/util.macVirtualization.test.js`

Created unit tests for the virtualization detection utilities.

## Benefits

These enhancements provide the following benefits:

1. **Improved Game Discovery**: Vortex can now discover games installed in virtualized environments
2. **Better Windows Game Support**: Windows games running through Crossover or Parallels can be managed
3. **Mac App Store Integration**: Native Mac App Store games are now supported
4. **Enhanced Drive Detection**: Game discovery now includes virtualized drives
5. **Future-Proof**: The architecture allows for easy addition of other virtualization software

## Technical Details

### Virtualization Detection

The virtualization detection works by:
1. Checking for installed virtualization software (Crossover, Parallels)
2. Locating virtual environments (Crossover bottles, Parallels VMs)
3. Mapping virtual drives to accessible paths
4. Including these paths in the game discovery process

### Game Store Enhancements

Existing game store implementations were enhanced to:
1. Check standard installation paths
2. Fall back to virtualized environment paths
3. Maintain backward compatibility
4. Provide detailed logging for debugging

### Mac App Store Extension

The new extension:
1. Scans standard Mac App Store installation directories
2. Uses naming heuristics to identify games
3. Integrates with the existing game store framework
4. Provides a foundation for future enhancements

## Testing

Unit tests were created for the virtualization detection utilities to ensure:
1. Proper path detection
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

## Compatibility

These changes maintain full backward compatibility with:
1. Existing game store implementations
2. Current game discovery processes
3. All supported platforms (Windows, macOS, Linux)
4. Existing user configurations

The enhancements only add new functionality without breaking existing features.