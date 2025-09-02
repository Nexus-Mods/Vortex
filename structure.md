# Project Structure

- **/**: project base directory. contains mostly configuration on the top level
  - **src/**: Vortex source code
    - *main.ts*: Entry point of the main process
    - *renderer.tsx*: Entry point of render processes
    - *actions/index.ts*: globally available actions that can be called to manipulate application state (extensions can of course declare their own actions)
    - *index(.dev).html*: The top-level web-page being displayed. This is very minimal as the actual content is inserted in renderer.tsx. The variant for development has more relaxed CSPs to ease development
    - **extensions/**: embedded extensions (statically loaded)
    - **reducers/**: contains the core application reducers that are run as the result of actions to modify application state. Extensions will add their own reducers on top of these.
      - *index.ts*: top-level index, references the other reducer files
    - **types/**: contains interfaces for our own data types
    - **util/**: contains classes that didn't fit anywhere else
    - **controls/**: contains reusable react components used throughout the application (and exposed through the api)
    - **views/**: contains the react views that make up the main application user interface
    - **stylesheets/**: (s)css for the default application look
  - **extensions/**: bundled extensions (dynamically loaded but shipped with the main application)
  - **__mocks__/**: mocks for use in unit tests
  - **__tests__/**: unit tests
  - **.vscode/**: Configuration files for Visual Studio Code
    - *launch.json*: launch options (F5 primarily)
    - *tasks.json*: ide build commands (ctrl-shift-b)
    - *settings.json*: project-wide customizations of the ide (editor settings)
  - **build/**: contains assets for the packaging process (i.e. application icon)
  - **app/**: staging directory for production build
    - *package.json*: project file for production
  - **dist/**: production builds (one-click installer, updater) (unpacked and installers, created during packaging)
  - **dist_custom/**: production builds (lets user choose installation directory)
  - **out/**: development build (created by *npm build*)
  - **node_modules/**: dependencies (created by *npm install*)
  - **typings/**: public typings auto-retrieved from public repositories
  - **typings.custom/**: custom typings for libraries that don't have any yet or where those that exist are incomplete or broken 
    - *index.d.ts*: top-level index, references the other typings

# Configuration files
- package.json: project file for development
- tsconfig.json: configuration file for the typescript compiler 
- .eslintrc.js: configuration for our coding guidelines
- .npmrc: configuration for electron headers URL
- .yarnrc: yarn-specific configuration for package management and build settings
- BuildSubprojects.json: configuration for bundled extensions
- electron-builder-*.json: configuration for (various) installers, only oneclick, advanced and ci are actively being used, the rest is there for reference
- InstallAssets.json: lists static assets to be included in builds (can specify if assets are for development, production or both)
- versions.json: specifies minimum Vortex version that is allowed to send feedback. Not sure if this is actually obeyed by the server
- webpack.*.config.js: bundler configuration for release builds (development builds are not bundled)

# Utility scripts
- bootstrap.ps1: Automatically installs the tools required to build Vortex, checks out the repo, starts a development build
- updateLicenses.js: Update list of included third-party modules and their licenses, gets displayed on the About screen.
- BuildSubprojects.js: Builds all bundled extensions defined in BuildSubprojects.json. Features conditional retry mechanism that only runs second build pass if first pass has failures, reducing build time and eliminating duplicate output for successful builds.

# Scripts used as part of the install/build process
- checkPackages.js: Verifies there are no discrepancies between the two package.json files
- BuildSubprojects.js: Builds all bundled extensions that have been modified since the last invocation
- createMD5List.js: Generate list of md5 hashes of all files included in a build, used at startup (in release builds) to verify the Vortex install hasn't been corrupted
- InstallAssets.js: Install static asset files to the correct location
- postinstall.js: verifies all native modules were built, yarn doesn't necessarily produce an error message if noe failed. Will further warn if modules that we expect to get prebuilt had to be built
- setupTests.js: part of the jest unit testing framework

# package.json tasks

- install: run with `yarn install` to download & install dependencies and build native modules
- build: run with `yarn build` to build project for development
- buildwatch: run with `yarn buildwatch` to build project and watch for changes
- subprojects: run with `yarn subprojects` to build only bundled extensions
- test: run with `yarn test` to execute test suite
- start: run with `yarn start` to launch program in development mode
- start with log: run with `yarn start --user-data /tmp/vortex-test-logs` to launch program in development mode with logging enabled
- dist: run with `yarn dist` to create release installers (one-click and custom directory options)
- ci: run with `yarn ci` to create unsigned release build

# Building on macOS

## Prerequisites
1. Install Node.js (LTS version recommended)
2. Install Yarn package manager
3. Install Xcode Command Line Tools:
   ```bash
   xcode-select --install
   ```
4. Install required build tools:
   ```bash
   brew install python cmake
   ```

## Development Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/Nexus-Mods/Vortex.git
   cd Vortex
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```
   Note: Some Windows-specific native modules are marked as optional dependencies and will be skipped on macOS and Linux.

3. Build the project:
   ```bash
   yarn build
   ```

4. Start the development server:
   ```bash
   yarn start
   ```

## Known macOS Considerations
- Windows-specific native modules (winapi-bindings, etc.) are marked as optional dependencies
- Mock implementations are provided in `__mocks__` directory for Windows-only functionalities
- Some features may have limited functionality on macOS due to platform differences
- File path handling may need special attention due to different path separators

## Testing on macOS

The test suite has been updated to ensure compatibility with macOS development environments while maintaining full compatibility with Windows testing:

### Test Fixes for macOS Compatibility

1. **Disk Space Tests**: Updated to handle volume detection differences between macOS and Windows
   - macOS uses root path comparison for volume detection
   - Tests now mock `process.platform` to 'win32' when testing disk space functionality
   - This ensures consistent behavior across platforms without affecting Windows test execution

2. **FOMOD Installer Tests**: Updated to match new instance-based architecture
   - Action creators now include `instanceId` parameter
   - Reducer tests updated to handle `instances[instanceId]` state structure
   - Changes reflect architectural improvements in the FOMOD installer system

3. **Mock Enhancements**: Added missing utility functions to vortex-api mock
   - Added `deleteOrNop` and `setSafe` utility functions
   - Ensures feedback reducer tests run successfully on all platforms

### Running Tests

```bash
yarn test
```

All tests should pass on macOS with the same results as Windows. The test fixes are designed to:
- Enable Mac port development
- Maintain Windows test compatibility
- Provide consistent cross-platform testing experience

## Troubleshooting
1. If native module build fails:
   ```bash
   yarn rebuild
   ```
   This uses yarn's rebuild command to recompile native modules

2. If you encounter module resolution issues:
   ```bash
   yarn clean        # Clean build artifacts
   rm -rf node_modules
   yarn cache clean  # Clear yarn's package cache
   yarn install      # Fresh install of dependencies
   ```

3. For yarn-specific issues:
   - Check yarn version: `yarn --version`
   - Verify yarn's global configuration: `yarn config list`
   - Update yarn if needed: `npm install -g yarn`

4. For development environment issues:
   - Ensure all prerequisites are installed
   - Check system Python version (some native modules may require Python 2.x)
   - Verify Xcode Command Line Tools installation
