# macOS Integration Guide for Vortex Mod Manager

This comprehensive guide covers all aspects of macOS integration for Vortex Mod Manager, including development, building, deployment, and compatibility features.

## Table of Contents

1. [Overview](#overview)
2. [Development Setup](#development-setup)
3. [Build Process](#build-process)
4. [Code Signing & Notarization](#code-signing--notarization)
5. [Compatibility Features](#compatibility-features)
6. [Game Support](#game-support)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

## Overview

The macOS integration work focused on six main areas:
1. Extension Installation Flow on macOS
2. macOS Compatibility Layer enhancements
3. React Rendering improvements in Game Screen
4. Build Process optimizations
5. macOS Game Filtering capabilities
6. Balatro game integration

All features maintain full backward compatibility with existing functionality.

## Development Setup

### Automated Submodule Management

This repository includes automated tools for managing submodules on macOS:

- Git hooks automatically run `fix_submodules.sh` after checkout, merge, and rewrite operations
- `.gitmodules` file configured for macOS-specific branches
- Git alias `git fix-submodules` available for manual operations

### Manual Submodule Operations

```bash
# Update all submodules to correct branches
git fix-submodules

# Or run the script directly
./fix_submodules.sh
```

## Build Process

### Prerequisites

- Node.js 16+ 
- Yarn package manager
- Xcode Command Line Tools
- Apple Developer account (for signing)

### Build Commands

```bash
# Development build
npm run build:macos

# Production build with signing
npm run build:macos:signed

# Build with notarization
node build-macos.js --notarize
```

### Build Script Features

The `build-macos.js` script provides:
- Webpack application building
- Electron-builder packaging
- Automated code signing
- Apple notarization
- Comprehensive error handling

## Code Signing & Notarization

### Prerequisites

1. **Apple Developer Account** - Active membership required
2. **Developer ID Certificate** - Installed in Keychain
3. **App-Specific Password** - Generated at appleid.apple.com
4. **Team ID** - Found in Apple Developer account

### Environment Setup

Create `.env` file with your credentials:

```bash
APPLE_ID=your-apple-id@example.com
APPLE_ID_PASSWORD=your-app-specific-password
APPLE_TEAM_ID=your-team-id
CSC_IDENTITY_AUTO_DISCOVERY=true
```

### Signing Process

The build process automatically:
1. Signs all binaries and frameworks
2. Creates signed application bundle
3. Submits to Apple for notarization
4. Staples notarization ticket to app

## Compatibility Features

### Extension Installation

Enhanced for macOS with:
- Synchronous extraction with timing controls
- Retry mechanisms for file validation
- Comprehensive logging
- Improved error handling
- Extended timeout values (30s extraction, 20s validation)

### Game Discovery System

- Priority-based discovery for different game sources
- Path normalization for Windows-style paths
- Executable resolution with Windows-to-macOS mapping
- Expanded compatibility database

### Path Normalization

Automatic conversion of Windows paths to macOS equivalents:
- `C:\Users\...\AppData\Roaming\Vortex` → `/Users/.../Library/Application Support/Vortex`
- `C:\Program Files\Vortex` → `/Applications/Vortex.app/Contents`

## Game Support

### Supported Games

- **Balatro** (primary focus with dedicated integration)
- **Cyberpunk 2077**
- **Stardew Valley**
- **RimWorld**
- **Factorio**
- **Kenshi**
- **Mount & Blade II: Bannerlord**
- **The Witcher 3: Wild Hunt**
- **Subnautica** and **Below Zero**
- **No Man's Sky**
- **Civilization VI**

### Game-Specific Features

- Executable name mapping for Windows games
- Custom discovery paths
- Platform-specific mod installation
- Enhanced compatibility validation

## Testing

### Test Structure

```
test/
├── macos/           # macOS-specific tests
├── integration/     # Integration tests
├── debug/          # Debug utilities
└── util/           # Test utilities
```

### Running Tests

```bash
# Run all macOS tests
npm test -- test/macos/

# Run specific test
node test/macos/test_macos_functionality.js

# Debug architecture detection
node test/debug/debug_architecture.js
```

## Troubleshooting

### Common Issues

1. **Extension Installation Failures**
   - Check file system permissions
   - Verify extraction tool availability
   - Review timing in logs

2. **Game Discovery Issues**
   - Verify game installation paths
   - Check executable name mapping
   - Review compatibility database

3. **Build/Signing Issues**
   - Verify Developer ID certificate
   - Check environment variables
   - Validate Team ID and credentials

### Debug Tools

- `debug_architecture.js` - Architecture detection
- `debug_discovery.js` - Game discovery
- `debug_extension_loading.js` - Extension loading
- `final_mac_fix_verification.js` - Comprehensive verification

### Logs

Check application logs at:
- `~/Library/Logs/Vortex/`
- Console output during development
- Build process logs

## Contributing

When contributing to macOS features:

1. Test on multiple macOS versions
2. Verify compatibility with existing features
3. Update documentation as needed
4. Follow existing code patterns
5. Add appropriate tests

## Support

For macOS-specific issues:
1. Check this documentation
2. Review existing test files
3. Run debug utilities
4. Check application logs
5. Create detailed issue reports

---

*This guide consolidates information from multiple development documents and represents the current state of macOS integration in Vortex Mod Manager.*