# macOS Enhancements Summary

This document summarizes all the enhancements made to improve macOS support for game store extensions in Vortex.

## 1. GOG Galaxy Extension

### Enhancements Made:
- Removed Windows-only restriction in BuildSubprojects.json
- Implemented native macOS path detection for GOG Galaxy application
- Added support for game discovery on macOS using GOG Galaxy data directories
- Implemented dynamic imports for Windows-specific modules to prevent macOS compatibility issues
- Added proper error handling for missing directories and files

### Key Features:
- Supports standard GOG Galaxy installation paths: `/Applications/GOG Galaxy.app` and `~/Applications/GOG Galaxy.app`
- Game discovery through `~/Library/Application Support/GOG.com/Galaxy/games` directory
- Parses game information from gameinfo files
- Launches games through the GOG Galaxy app bundle

## 2. Origin/EA App Extension

### Enhancements Made:
- Removed Windows-only restriction in BuildSubprojects.json
- Implemented native macOS path detection for Origin/EA App applications
- Added support for game discovery on macOS using Origin data directories
- Implemented dynamic imports for Windows-specific modules to prevent macOS compatibility issues

### Key Features:
- Supports standard Origin/EA App installation paths: `/Applications/Origin.app`, `/Applications/EADesktop.app`, and user Applications directory
- Game discovery through `~/Library/Application Support/Origin/LocalContent` directory
- Parses manifest files to extract game information
- Handles both Origin and EA Desktop app installations

## 3. Ubisoft Connect Extension

### Enhancements Made:
- Created new Ubisoft Connect extension with full macOS support
- Implemented native macOS path detection for Ubisoft Connect application
- Added support for game discovery on macOS using Ubisoft data directories

### Key Features:
- Supports standard Ubisoft Connect installation path: `/Applications/Ubisoft Connect.app`
- Game discovery through `~/Library/Application Support/Ubisoft/Ubisoft Game Launcher` directory
- Launches games through the ubisoft:// protocol
- Handles game installation path detection in common locations

## 4. Epic Games Store Enhancement

### Enhancements Made:
- Enhanced existing Epic Games Launcher implementation with better macOS support
- Improved path detection for Epic Games Launcher installations in virtualization environments
- Added support for Crossover, VMware, and VirtualBox installations

### Key Features:
- Supports standard Epic Games Launcher installation path: `~/Library/Application Support/Epic`
- Detects Epic Games Launcher in Crossover bottles
- Detects Epic Games Launcher in VMware VMs
- Detects Epic Games Launcher in VirtualBox VMs
- Game discovery through manifest files in the Epic data directory

## 5. Mac App Store Extension Improvement

### Enhancements Made:
- Improved metadata retrieval for Mac App Store games
- Enhanced game identification heuristics
- Added support for reading app bundle information from Info.plist files

### Key Features:
- Uses `mdls` command to extract metadata from app bundles
- Reads additional information from Info.plist files using `plutil`
- Enhanced game identification algorithm based on app names and categories
- Supports both `/Applications` and `~/Applications` directories

## 6. Build Configuration Updates

### Enhancements Made:
- Updated BuildSubprojects.json to enable all game store extensions on macOS
- Added new Ubisoft Connect extension to the build configuration
- Removed platform restrictions for extensions that work on macOS

## 7. Testing

### Enhancements Made:
- Created comprehensive unit tests for all new macOS functionality
- Added tests for path detection, game discovery, and game launching
- Implemented tests for all major game store extensions

## Conclusion

All requested macOS enhancements have been successfully implemented, providing full support for GOG Galaxy, Origin/EA App, Ubisoft Connect, Epic Games Store, and Mac App Store on macOS. The implementations follow platform-specific conventions and provide robust error handling for various installation scenarios.