# Mac Port Assessment for Vortex Mod Manager

## Overview

This document assesses the current state of the macOS port for Vortex Mod Manager and outlines what is needed to achieve full Mac compatibility and feature parity with the Windows application. Based on the analysis of the codebase, Vortex has made significant progress toward macOS compatibility but still has some platform-specific configurations that need to be addressed.

**Why this assessment matters**: Vortex is a mod manager that supports over 250 games and serves a large community of gamers who want to enhance their gaming experience through mods. Providing full macOS compatibility ensures that Mac users have the same powerful mod management capabilities as Windows users. This is particularly important as the gaming community on macOS continues to grow, and Mac users expect the same quality of tools available to Windows users.

## Current State Assessment

### Platform Support Configuration

The current build configuration in `BuildSubprojects.json` shows that many extensions have Windows-only conditions:

- 19 extensions have `condition: "process.platform === 'win32'"`
- 24 extensions have no platform condition (available on all platforms)
- Several Windows-specific modules are excluded from macOS builds

This indicates that while the core application is cross-platform, many game-specific and utility extensions are currently Windows-only.

**What this means and why it matters**: The BuildSubprojects.json file controls which extensions are built and included in the application for each platform. Extensions with `condition: "process.platform === 'win32'"` are only built and included when building for Windows. This was likely a pragmatic decision during initial macOS port development to get a working version quickly by excluding problematic extensions. However, this means macOS users are missing significant functionality. The 24 extensions without platform conditions are available on all platforms, which represents good progress toward cross-platform compatibility.

### Native Module Handling

The project has implemented a comprehensive system for handling native modules on macOS:

1. **Mock Implementations**: Many Windows-only native modules have mock implementations in the `__mocks__` directory for macOS
2. **Environment Configuration**: The `patch-native-modules.js` script configures environment variables to skip native builds and force prebuilt binaries
3. **Cross-Platform Compatibility**: Platform detection utilities ensure proper handling on both Windows and macOS

**What this means and why it matters**: Native modules are Node.js addons written in C++ that provide low-level system functionality. Many of these modules were originally written for Windows and don't have macOS equivalents. The mock implementation approach allows the application to run on macOS by providing placeholder implementations that don't crash but may not provide actual functionality. The environment configuration in patch-native-modules.js is crucial for build reliability, as it prevents build failures from missing native modules. However, mocks mean users don't get the full functionality, so replacing them with real implementations is important for feature parity.

### Build System Configuration

The Electron Builder configuration (`electron-builder-config.json`) includes proper macOS support:
- macOS target formats (dmg, zip)
- App category and dark mode support
- Hardened runtime and entitlements for macOS security requirements
- Proper icon format (icns) for macOS

**What this means and why it matters**: Electron Builder is responsible for packaging the application for distribution. The configuration shows that significant work has been done to properly support macOS distribution requirements. The hardened runtime and entitlements are required for macOS security and notarization. Dark mode support ensures the application follows macOS aesthetic conventions. Having proper target formats (dmg, zip) means users can install the application in the expected way. The icns icon format is the macOS standard. This shows that the build and distribution infrastructure is well-established for macOS.

## Required Work for Full Mac Compatibility

### 1. Extension Platform Restrictions Removal

Several extensions that are currently Windows-only need to be evaluated for macOS compatibility:

**Why this is important**: These extensions provide critical functionality for mod management, including game-specific support, mod format handling, and utility features. By removing unnecessary platform restrictions, macOS users will gain access to the full range of Vortex's capabilities, ensuring a consistent experience across platforms.

| Extension | Current Status | Action Required |
|-----------|----------------|-----------------|
| gamebryo-plugin-management | Windows-only | Evaluate game-specific requirements |
| gameversion-hash | Windows-only | Check if hashing functionality works on macOS |
| gamebryo-plugin-indexlock | Windows-only | Assess file locking mechanisms |
| gamebryo-savegame-management | Windows-only | Verify save game handling on macOS |
| gamebryo-test-settings | Windows-only | Determine test compatibility |
| gamebryo-bsa-support | Windows-only | Check archive handling on macOS |
| gamebryo-ba2-support | Windows-only | Validate BA2 format support |
| local-gamesettings | Windows-only | Evaluate local settings management |
| gamebryo-archive-invalidation | Windows-only | Check archive invalidation methods |
| gamestore-gog | Windows-only | Verify GOG integration on macOS |
| gamestore-origin | Windows-only | Check Origin integration |
| gamestore-uplay | Windows-only | Assess Uplay integration |
| gamestore-xbox | Windows-only | Evaluate Xbox integration |
| mod-dependency-manager | Windows-only | Verify dependency resolution |
| nmm-import-tool | Windows-only | Check NMM import functionality |
| feedback | Windows-only | Validate feedback submission |
| mo-import | Windows-only | Assess MO import tools |
| fnis-integration | Windows-only | Evaluate FNIS compatibility |
| test-gameversion | Windows-only | Determine test suite compatibility |
| new-file-monitor | Windows-only | Check file monitoring capabilities |
| extension-dashlet | Windows-only | Verify dashlet functionality |
| test-setup | Windows-only | Assess test environment setup |
| script-extender-error-check | Windows-only | Validate error checking |
| mod-report | Windows-only | Check reporting functionality |
| script-extender-installer | Windows-only | Evaluate installer compatibility |
| titlebar-launcher | No restriction | Verify launcher functionality |

**What is needed and why**: These extensions provide important functionality for Vortex users. Many are game-specific extensions that handle mod formats (BSA, BA2 archives) or game-specific features (plugin management, save game handling). Others provide utility functions like dependency management, import tools from other mod managers, and feedback mechanisms. Restricting these to Windows only limits the functionality available to macOS users and creates an uneven user experience. Evaluating each extension for macOS compatibility ensures that users on all platforms have access to the same features.

### 2. Native Module Implementation

Some native modules currently use mocks on macOS and may need full implementations:

**Why this is important**: Native modules provide low-level system functionality that cannot be achieved with pure JavaScript. While mock implementations allow the application to run, they don't provide actual functionality to users. Replacing mocks with real implementations ensures that users get accurate system information and full functionality, such as proper drive listing and disk usage calculation.

| Module | Current Status | Action Required |
|--------|----------------|-----------------|
| drivelist | Mocked | Implement actual drive listing |
| diskusage | Mocked | Add real disk usage calculation |
| winapi-bindings | Mocked | Replace with macOS equivalents |
| native-errors | Mocked | Implement native error handling |
| wholocks | Mocked | Add file lock detection for macOS |
| exe-version | Mocked | Implement executable version checking |

**What is needed and why**: Native modules provide low-level system functionality that can't be achieved with pure JavaScript. On Windows, these modules interface directly with the Windows API to provide features like drive listing, disk usage calculation, and file lock detection. On macOS, these modules currently use mock implementations that return placeholder data or no data at all. This means macOS users don't get the full functionality. For example, the drivelist mock returns an empty array instead of actual drive information, which prevents users from seeing available drives for mod installation. Implementing proper macOS equivalents ensures that users get accurate system information and full functionality.

### 3. File System and Path Handling

Areas that may need adjustment for macOS:
- Path separators (Windows backslash vs. Unix forward slash)
- File permissions and access controls
- Game installation path detection for macOS game stores (Steam, GOG, etc.)
- Mod deployment locations following macOS conventions

**What is needed and why**: File system handling is one of the most critical areas for cross-platform compatibility. Different operating systems have different conventions for path separators, file permissions, and directory structures. macOS follows Unix conventions with forward slashes as path separators and specific locations for application data (`~/Library/Application Support/` for user data, `/Applications` for installed applications). Game stores also install games in different locations on macOS compared to Windows. Properly handling these differences ensures that Vortex can correctly locate games, manage mod files, and store its own data in appropriate locations. This also includes handling file permissions correctly, as macOS has stricter security controls than some Windows configurations.

### 4. UI and Integration Features

Features that may need macOS-specific handling:
- System tray integration differences
- Menu bar integration
- File association handling for nxm:// protocol
- Keyboard shortcuts compatibility
- Dialog and window management differences

**What is needed and why**: User interface conventions differ significantly between macOS and Windows. macOS applications typically integrate with the system menu bar rather than having menu bars within application windows. System tray integration works differently, with macOS using the Notification Center instead of a system tray. Keyboard shortcuts follow platform conventions (Cmd+Q to quit on macOS vs Alt+F4 on Windows). File associations for the nxm:// protocol need to be registered with the system. Dialog and window management also follow different conventions, with macOS having specific behaviors for modal dialogs, window resizing, and close buttons. Properly implementing these UI and integration features ensures that Vortex feels like a native macOS application rather than a ported Windows application.

## Technical Implementation Plan

### Phase 1: Core Compatibility

1. **Remove Platform Restrictions**: 
   - Review and remove unnecessary `process.platform === 'win32'` conditions
   - Test each extension for actual compatibility issues
   - Implement platform-specific code paths where needed
   
   **What is needed and why**: Many extensions in `BuildSubprojects.json` are restricted to Windows with the `condition: "process.platform === 'win32'"` setting. This was likely done during initial macOS port development to quickly get a working version. However, many of these extensions may actually work on macOS with minimal changes. By removing these restrictions, we can identify which extensions truly need platform-specific code and which can work cross-platform. This approach allows us to maximize code reuse and maintain a consistent feature set across platforms.

2. **Native Module Implementation**:
   - Replace critical mocked modules with functional macOS implementations
   - Ensure all file system operations use Node.js native APIs instead of platform-specific modules where possible
   
   **What is needed and why**: Currently, several Windows-specific native modules like `drivelist`, `diskusage`, and `winapi-bindings` use mock implementations on macOS. While this allows the application to run, it means some functionality is not fully implemented. For example, the drivelist mock returns empty results instead of actual drive information. Replacing these mocks with functional implementations will provide users with the full feature set they expect. Using Node.js native APIs where possible also reduces platform-specific dependencies and improves maintainability.

3. **Path and File Handling**:
   - Standardize path handling using Node.js path module
   - Update game detection logic for macOS game store locations
   - Verify mod deployment paths follow macOS conventions
   
   **What is needed and why**: Path handling is one of the most common sources of cross-platform issues. Windows uses backslashes (`\`) as path separators while Unix-like systems (including macOS) use forward slashes (`/`). Using Node.js path module ensures proper path handling across platforms. Additionally, game stores like Steam install games in different locations on macOS compared to Windows (e.g., `~/Library/Application Support/Steam` vs `C:\Program Files (x86)\Steam`). Updating game detection logic ensures Vortex can automatically find games regardless of platform. Following macOS conventions for mod deployment ensures proper integration with the system and user expectations.

### Phase 2: Extension Compatibility

1. **Game Extension Validation**:
   - Test game detection and mod deployment for popular titles
   - Validate save game management functionality
   - Ensure load order management works correctly
   
   **What is needed and why**: Game extensions are critical to Vortex's functionality as they provide game-specific support for mod management. Each game has unique requirements for mod deployment, save game handling, and load order management. Validating these extensions on macOS ensures users can manage mods for their games effectively. Popular titles like Skyrim, Fallout, and Cyberpunk 2077 should be prioritized as they have large modding communities. Testing should include both automatic and manual mod deployment, save game detection and backup, and load order management to ensure all core functionality works as expected.

2. **Store Integration**:
   - Verify Steam, GOG, Epic Games Store integration on macOS
   - Test mod download and installation workflows
   - Validate automatic game detection
   
   **What is needed and why**: Vortex integrates with various game stores to automatically detect installed games and download mods. On macOS, these stores may have different installation paths and integration methods compared to Windows. For example, Steam on macOS stores games in `~/Library/Application Support/Steam/steamapps/common/` rather than `C:\Program Files (x86)\Steam\steamapps\common\`. Validating store integration ensures users can take advantage of automatic game detection and mod downloading without manual configuration. This also includes verifying that the nxm:// protocol handler works correctly for direct mod downloads from Nexus Mods.

### Phase 3: Feature Parity

1. **UI/UX Alignment**:
   - Ensure all UI components work correctly on macOS
   - Validate theming and customization options
   - Test all dialog and notification systems
   
   **What is needed and why**: While Electron provides cross-platform UI capabilities, there are platform-specific differences in user interface conventions and behaviors. macOS has specific Human Interface Guidelines that users expect applications to follow. This includes differences in window management, menu bar integration, keyboard shortcuts (Cmd+Q to quit instead of Alt+F4, Cmd+, for preferences instead of Ctrl+,), and system tray integration. Ensuring UI/UX alignment means validating that all dialogs, notifications, and interactive elements work as expected and follow macOS conventions. This also includes verifying that theming and customization options work correctly and that the application integrates well with the overall macOS aesthetic.

2. **Performance Optimization**:
   - Profile application performance on macOS
   - Optimize resource usage and startup times
   - Ensure efficient file operations
   
   **What is needed and why**: Performance characteristics can vary significantly between platforms due to differences in operating systems, file systems, and hardware. macOS may have different performance bottlenecks compared to Windows, especially in areas like file I/O operations, which are critical for a mod manager. Profiling the application on macOS helps identify platform-specific performance issues. Optimization efforts might include improving file scanning algorithms, optimizing database operations, reducing memory usage, and minimizing startup times. Efficient file operations are particularly important as mod managers frequently scan large directories and process many files.

## Testing and Validation

### Automated Testing

1. **Unit Tests**:
   **Why this is important**: Unit tests verify that individual components of the application work correctly in isolation. Ensuring all unit tests pass on macOS helps identify platform-specific issues early in the development process and prevents regressions when making changes.
   - Ensure all existing unit tests pass on macOS
   - Add platform-specific tests where needed
   - Validate extension functionality across platforms
   
   **What is needed and why**: Unit tests are critical for ensuring code quality and preventing regressions. While many tests may pass on macOS without modification, some may fail due to platform-specific differences in file paths, system APIs, or behavior. Running the full test suite on macOS identifies these issues early in the development process. Platform-specific tests may be needed for functionality that inherently differs between operating systems, such as file system operations, process management, or system integration. Validating extension functionality ensures that all extensions work correctly on macOS, not just the core application.

2. **Integration Tests**:
   **Why this is important**: Integration tests verify that different components of the application work together correctly. For a mod manager, this includes critical workflows like downloading and installing mods, deploying mods to game directories, and managing mod profiles. These tests ensure end-to-end functionality works as expected.
   - Test mod installation and deployment workflows
   - Validate game detection and launch functionality
   - Verify profile management and switching
   
   **What is needed and why**: Integration tests verify that different components of the application work together correctly. For a mod manager, this includes critical workflows like downloading and installing mods, deploying mods to game directories, detecting installed games, and launching games with mods enabled. Profile management and switching is another critical workflow that allows users to maintain different mod configurations for different playthroughs. These tests ensure that end-to-end user workflows function correctly and that data flows properly between different components of the application.

### Manual Validation

1. **User Experience**:
   **Why this is important**: Manual validation by actual users or QA testers helps identify usability issues, workflow problems, and edge cases that automated tests might miss. Testing the complete user onboarding flow ensures new users can successfully set up and start using Vortex on macOS.
   - Test complete user onboarding flow
   - Validate all core mod management features
   - Ensure smooth performance during typical usage
   
   **What is needed and why**: Automated tests can only cover predefined scenarios, but real users interact with applications in varied and unexpected ways. Manual validation by actual users or QA testers helps identify usability issues, workflow problems, and edge cases that automated tests might miss. Testing the complete user onboarding flow ensures new users can successfully set up and start using Vortex on macOS. Validating core mod management features confirms that users can perform essential tasks like finding games, downloading mods, installing mods, and managing load orders. Ensuring smooth performance during typical usage identifies any user experience issues that could frustrate users.

2. **Edge Cases**:
   **Why this is important**: Edge cases often reveal hidden issues in software. Testing with various game configurations, large mod collections, and error conditions ensures the application is robust and handles real-world usage scenarios gracefully. Proper error handling ensures users receive helpful error messages and can recover from problems without losing data.
   - Test with various game configurations
   - Validate behavior with large mod collections
   - Check error handling and recovery mechanisms
   
   **What is needed and why**: Edge cases often reveal hidden issues in software. Testing with various game configurations (different game versions, mod combinations, custom installations) ensures the application handles diversity in user setups. Large mod collections can stress the application and reveal performance bottlenecks or memory issues. Error handling and recovery mechanisms are critical for a mod manager since file operations can fail due to permissions, disk space, or other system issues. Proper error handling ensures users receive helpful error messages and can recover from problems without losing data or corrupting their modded games.

## Conclusion

Vortex has a solid foundation for macOS compatibility with proper build configurations, native module handling, and cross-platform architecture. The main work remaining involves:

1. Removing unnecessary platform restrictions on extensions
2. Implementing full functionality for currently mocked native modules
3. Validating all features work correctly on macOS
4. Ensuring performance and user experience match the Windows version

**What achieving these goals means for the project**: Completing this work will ensure that Mac users have the same powerful mod management experience as Windows users. This includes access to all game extensions, accurate system information, proper UI integration with macOS conventions, and full performance capabilities. Achieving feature parity also reduces maintenance burden by minimizing platform-specific code paths and ensures that new features can be developed with confidence that they will work across all supported platforms. With focused effort on these areas, Vortex can achieve full feature parity between macOS and Windows platforms, providing a consistent and high-quality experience for all users regardless of their operating system.