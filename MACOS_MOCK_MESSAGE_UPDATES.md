# macOS Mock Message Updates

This document describes the updates made to improve the messaging about native macOS implementations and mocks in the Vortex codebase.

## Overview

Previously, the console messages during installation and build processes referred to all non-Windows modules on macOS with generic messages. This update provides more specific and descriptive messages that are grouped with the module they explain.

## Updated Files

### 1. scripts/patch-native-modules.js

**Changes:**
- Grouped explanation messages with each module they explain
- Added specific reasons why each module is mocked
- Improved clarity for developers and users

**Example Messages:**
- 🔧 Using mock implementation for leveldown (native LevelDB functionality not yet implemented for macOS)
- 🔧 Using mock implementation for winapi-bindings (Windows-specific APIs not applicable on macOS)
- 🔧 Using mock implementation for vortex-api (testing-only mock, not needed for production)

### 2. scripts/configure-native-modules.js

**Changes:**
- Grouped explanation messages with each module they explain
- Added specific reasons why each module is mocked
- Used different emojis to distinguish between native implementations and mocks

**Example Messages:**
- ✅ Using native macOS implementation for bsdiff-node
- 🎭 Using mock for leveldown on macOS (native LevelDB functionality not yet implemented)
- 🎭 Using mock for winapi-bindings on macOS (Windows-specific APIs not applicable on macOS)

### 3. postinstall.js

**Changes:**
- Grouped explanation messages with each module they explain
- Added specific reasons why each module is mocked
- Improved clarity about what happens when no implementation is found

**Example Messages:**
- Using native macOS implementation for diskusage
- Using mock for leveldown on macOS (native LevelDB functionality not yet implemented)
- No implementation found for vortexmt on macOS, proceeding with verification

## Benefits

1. **Clarity:** Users and developers can now clearly see why each module is mocked
2. **Accuracy:** Messages accurately explain the reason for mocking each module
3. **Transparency:** Clear distinction between implemented functionality and mocks with specific reasons
4. **Developer Experience:** Makes it easier for developers to understand the current state of macOS support

## Module-Specific Messages

Each module now has a specific message explaining why it's mocked:

1. **leveldown** - native LevelDB functionality not yet implemented
2. **modmeta-db** - native database functionality not yet implemented
3. **native-errors** - native error handling not yet implemented
4. **original-fs** - testing-only mock, not needed for production
5. **vortex-api** - testing-only mock, not needed for production
6. **winapi-bindings** - Windows-specific APIs not applicable on macOS
7. **fomod-installer** - pure JavaScript implementation preferred
8. **node-addon-api** - build-time dependency, not a runtime mock
9. **vortexmt** - native multithreading not yet implemented
10. **xxhash-addon** - native xxHash functionality not yet implemented

## Future Improvements

As more native functionality is implemented for macOS, these messages will automatically reflect the changes, providing accurate information about what is available.