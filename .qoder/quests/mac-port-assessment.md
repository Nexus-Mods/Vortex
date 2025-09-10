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

| Extension | Current Status | Action Required | Detailed Functionality and Required Updates |
|-----------|----------------|-----------------|------------------|
| gamebryo-plugin-management | Windows-only | Evaluate game-specific requirements | Manages plugin load order for Gamebryo-based games (Skyrim, Fallout). Handles .esp/.esm files and conflict resolution. Needs verification of file operations, path handling, and plugin scanning on macOS file system. |
| gameversion-hash | Windows-only | Check if hashing functionality works on macOS | Calculates and compares file hashes to determine game versions. Hashing algorithms should work the same on macOS, but file path handling and access permissions may need adjustment. |
| gamebryo-plugin-indexlock | Windows-only | Assess file locking mechanisms | Manages file locking for Gamebryo game plugins to prevent conflicts. File locking mechanisms differ between Windows and Unix systems, so this extension may need platform-specific implementations. |
| gamebryo-savegame-management | Windows-only | Verify save game handling on macOS | Handles save game detection, backup, and management for Gamebryo games. Path handling for save game locations and file operations need to be verified on macOS. |
| gamebryo-test-settings | Windows-only | Determine test compatibility | Provides testing capabilities for Gamebryo game extensions. Test frameworks and file operations should be validated on macOS. |
| gamebryo-bsa-support | Windows-only | Check archive handling on macOS | Handles BSA (Bethesda Softworks Archive) files used by Bethesda games. Archive extraction and creation functionality needs to be tested on macOS. |
| gamebryo-ba2-support | Windows-only | Validate BA2 format support | Manages BA2 (Bethesda Archive v2) files used by newer Bethesda games like Fallout 4 and Skyrim SE. Archive handling needs validation on macOS. |
| local-gamesettings | Windows-only | Evaluate local settings management | Manages local game settings and configuration files. Path handling for configuration files and file operations need to be verified on macOS. |
| gamebryo-archive-invalidation | Windows-only | Check archive invalidation methods | Handles archive invalidation for Gamebryo games, which is used to prioritize loose files over archived ones. File system operations and timestamp handling may differ on macOS. |
| gamestore-gog | Windows-only | Verify GOG integration on macOS | Integrates with GOG Galaxy to detect installed games and download mods. Integration needs to be updated to locate GOG games in macOS-specific directories and handle macOS-specific GOG Galaxy APIs. |
| gamestore-origin | Windows-only | Check Origin integration | Integrates with EA Origin to detect installed games. Path detection for Origin games and API integration need to be validated on macOS. |
| gamestore-uplay | Windows-only | Assess Uplay integration | Integrates with Ubisoft Connect (formerly Uplay) to detect installed games. Path detection and API integration need macOS-specific adjustments. |
| gamestore-xbox | Windows-only | Evaluate Xbox integration | Integrates with Xbox Game Pass/Windows Store to detect installed games. This extension may have limited functionality on macOS but should be evaluated for any cross-platform features. |
| mod-dependency-manager | Windows-only | Verify dependency resolution | Resolves and manages mod dependencies. Dependency resolution algorithms should work the same on macOS, but file operations and path handling need validation. |
| nmm-import-tool | Windows-only | Check NMM import functionality | Imports mods and profiles from Nexus Mod Manager. File import functionality and path handling need to be verified on macOS. |
| feedback | Windows-only | Validate feedback submission | Submits user feedback and crash reports to Nexus Mods. Network operations and file handling for logs need validation on macOS. |
| mo-import | Windows-only | Assess MO import tools | Imports mods and profiles from Mod Organizer. File import functionality and path handling need to be verified on macOS. |
| fnis-integration | Windows-only | Evaluate FNIS compatibility | Integrates with FNIS (Fores New Idles in Skyrim) to generate animation files. This tool is Windows-specific, so the extension may need to either provide macOS alternatives or gracefully handle lack of support. |
| test-gameversion | Windows-only | Determine test suite compatibility | Provides testing capabilities for game version detection. Test frameworks and file operations should be validated on macOS. |
| new-file-monitor | Windows-only | Check file monitoring capabilities | Monitors file system changes to detect new mods or changes. File system monitoring APIs differ between Windows and macOS, so this extension may need platform-specific implementations. |
| extension-dashlet | Windows-only | Verify dashlet functionality | Provides a dashboard widget for extension management. UI components should work the same on macOS, but platform-specific UI behaviors need validation. |
| test-setup | Windows-only | Assess test environment setup | Provides testing environment setup for extensions. Test frameworks and file operations should be validated on macOS. |
| script-extender-error-check | Windows-only | Validate error checking | Checks for errors in script extenders like SKSE, F4SE, etc. Error detection logic should work the same on macOS, but file access and parsing may need adjustments. |
| mod-report | Windows-only | Check reporting functionality | Generates reports about mod collections for troubleshooting. File operations and report generation should be validated on macOS. |
| script-extender-installer | Windows-only | Evaluate installer compatibility | Installs script extenders like SKSE, F4SE, etc. Installation processes and file operations need to be verified on macOS. This may have limited functionality on macOS as many script extenders are Windows-specific. |
| titlebar-launcher | No restriction | Verify launcher functionality | Provides game launching functionality through the title bar. Game launching mechanisms and process management need validation on macOS. |

**What is needed and why**: These extensions provide important functionality for Vortex users. Many are game-specific extensions that handle mod formats (BSA, BA2 archives) or game-specific features (plugin management, save game handling). Others provide utility functions like dependency management, import tools from other mod managers, and feedback mechanisms. Restricting these to Windows only limits the functionality available to macOS users and creates an uneven user experience. Evaluating each extension for macOS compatibility ensures that users on all platforms have access to the same features.

### 2. Native Module Implementation

Some native modules currently use mocks on macOS and may need full implementations:

**Why this is important**: Native modules provide low-level system functionality that cannot be achieved with pure JavaScript. While mock implementations allow the application to run, they don't provide actual functionality to users. Replacing mocks with real implementations ensures that users get accurate system information and full functionality, such as proper drive listing and disk usage calculation.

| Module | Current Status | Action Required | Detailed Functionality and Required Updates |
|--------|----------------|-----------------|------------------|
| drivelist | Mocked | Implement actual drive listing | Lists all connected drives and their properties. Currently returns empty results on macOS. Needs implementation using macOS system APIs or Node.js fs module to provide actual drive information. |
| diskusage | Mocked | Add real disk usage calculation | Calculates disk space usage for storage management. Currently returns placeholder data on macOS. Needs implementation using Node.js fs module or system commands to provide real disk usage statistics. |
| winapi-bindings | Mocked | Replace with macOS equivalents | Provides low-level Windows API access for various system operations. Completely non-functional on macOS. Needs replacement with macOS-specific implementations or cross-platform alternatives for required functionality. |
| native-errors | Mocked | Implement native error handling | Handles native system error codes and messages. Currently non-functional on macOS. Needs implementation to properly handle and translate macOS system errors. |
| wholocks | Mocked | Add file lock detection for macOS | Detects which processes are locking files to prevent conflicts. Currently non-functional on macOS. Needs implementation using macOS system APIs or alternative approaches to detect file locks. |
| exe-version | Mocked | Implement executable version checking | Extracts version information from Windows executable files. Non-functional on macOS. Needs implementation to handle macOS executable formats (Mach-O) and extract version information, or provide cross-platform version checking. |

**What is needed and why**: Native modules provide low-level system functionality that can't be achieved with pure JavaScript. On Windows, these modules interface directly with the Windows API to provide features like drive listing, disk usage calculation, and file lock detection. On macOS, these modules currently use mock implementations that return placeholder data or no data at all. This means macOS users don't get the full functionality. For example, the drivelist mock returns an empty array instead of actual drive information, which prevents users from seeing available drives for mod installation. Implementing proper macOS equivalents ensures that users get accurate system information and full functionality.

### 3. File System and Path Handling

Areas that may need adjustment for macOS:
- Path separators (Windows backslash vs. Unix forward slash)
- File permissions and access controls
- Game installation path detection for macOS game stores (Steam, GOG, etc.)
- Mod deployment locations following macOS conventions

**Detailed Requirements**:
1. **Path separators**: Use Node.js `path` module instead of hardcoded separators to ensure cross-platform compatibility.
2. **File permissions**: macOS has stricter permissions model. Ensure proper handling of read/write permissions for game directories and Vortex data directories.
3. **Game store paths**: Update detection logic for common game stores:
   - Steam: `~/Library/Application Support/Steam` (vs `C:Program Files (x86)Steam`)
   - GOG: `~/Library/Application Support/GOG.com/Galaxy` (vs `C:Program Files (x86)GOG Galaxy`)
   - Epic Games: `~/Library/Application Support/Epic` (vs `C:Program Files (x86)Epic Games`)
4. **Mod deployment**: Follow macOS conventions for file locations:
   - User data: `~/Library/Application Support/Vortex` (vs `%APPDATA%Vortex`)
   - Cache data: `~/Library/Caches/Vortex` (vs `%LOCALAPPDATA%Vortex`)

**What is needed and why**: File system handling is one of the most critical areas for cross-platform compatibility. Different operating systems have different conventions for path separators, file permissions, and directory structures. macOS follows Unix conventions with forward slashes as path separators and specific locations for application data (`~/Library/Application Support/` for user data, `/Applications` for installed applications). Game stores also install games in different locations on macOS compared to Windows. Properly handling these differences ensures that Vortex can correctly locate games, manage mod files, and store its own data in appropriate locations. This also includes handling file permissions correctly, as macOS has stricter security controls than some Windows configurations.

### 4. UI and Integration Features

Features that may need macOS-specific handling:
- System tray integration differences
- Menu bar integration
- File association handling for nxm:// protocol
- Keyboard shortcuts compatibility
- Dialog and window management differences

**Detailed Requirements**:
1. **System tray**: macOS uses the Notification Center instead of a system tray. Implement using Electron's `Tray` API with macOS-specific considerations.
2. **Menu bar**: macOS applications typically integrate with the global menu bar rather than having menu bars within application windows. Use Electron's `Menu` API to create macOS-style menus.
3. **File associations**: Register nxm:// protocol handler with the system using Electron's `app.setAsDefaultProtocolClient()` method and handle activation events properly.
4. **Keyboard shortcuts**: Follow macOS conventions (Cmd+Q to quit, Cmd+, for preferences) instead of Windows conventions (Alt+F4, Ctrl+,).
5. **Dialogs and windows**: Implement macOS-specific window management behaviors, including proper handling of modal dialogs, window resizing constraints, and close button behavior according to macOS Human Interface Guidelines.

**What is needed and why**: User interface conventions differ significantly between macOS and Windows. macOS applications typically integrate with the system menu bar rather than having menu bars within application windows. System tray integration works differently, with macOS using the Notification Center instead of a system tray. Keyboard shortcuts follow platform conventions (Cmd+Q to quit on macOS vs Alt+F4 on Windows). File associations for the nxm:// protocol need to be registered with the system. Dialog and window management also follow different conventions, with macOS having specific behaviors for modal dialogs, window resizing, and close buttons. Properly implementing these UI and integration features ensures that Vortex feels like a native macOS application rather than a ported Windows application.

## Technical Implementation Plan

**Implementation Approach**: The technical implementation should follow an iterative approach, starting with core compatibility and gradually expanding to full feature parity. Each phase should include thorough testing to ensure stability and prevent regressions. Cross-platform abstractions should be preferred over platform-specific code where possible to maintain codebase consistency and reduce maintenance burden.

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

**Testing Strategy**: A comprehensive testing approach should be employed, combining automated tests with manual validation. Automated tests should cover unit and integration testing across platforms, while manual validation should focus on user experience and edge cases. Testing should be performed on multiple macOS versions and hardware configurations to ensure broad compatibility.

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