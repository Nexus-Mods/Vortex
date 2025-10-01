# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Building and Development
- `yarn build` - Build project for development (TypeScript compilation to `out/`)
- `yarn buildwatch` - Build and watch for changes during development
- `yarn start` - Start Vortex in development mode
- `yarn subprojects` - Build only bundled extensions
- `yarn buildext` - Build a single extension using `./tools/buildScripts/buildSingleExtension.js`

### Repository Management
- `yarn modules:status` - Check status of all managed repositories
- `yarn modules:status cpp` - Check status of C++ projects only
- `yarn modules:summary` - Show project overview and statistics
- `yarn modules:setup` - Set up Git remotes for all repositories
- `yarn modules:create-branch <name>` - Create feature branch across repositories
- `yarn modules:delete-branch <name>` - Delete branch from repositories (supports --force --remote)
- `yarn modules:commit "<message>"` - Commit changes across repositories
- `yarn modules:push` - Push changes to remote repositories
- `yarn modules:workflow "<message>"` - Complete workflow: branch + commit + push + PR links
- `yarn modules:open-prs <branch-name>` - **Automatically open PR creation links in browser**

### Native Module Management
The project includes multiple C++ native modules and C# projects that are managed as separate Git repositories:

**C++ Projects**: winapi-bindings, bsatk, esptk, loot, gamebryo-savegame, bsdiff-node
**C# Projects**: fomod-installer (8 sub-projects), dotnetprobe (local)

**Repository Management Scripts**:
- `scripts/manage-node-modules.js` - Main repository management with filtering by project type
- `scripts/open-pr-links.js` - **Automated PR link opener for streamlined workflow**
- `scripts/convert-to-git.js` - Convert npm packages to Git repositories
- `scripts/update-package-branches.js` - Update package.json to use feature branches

### Automated PR Creation Workflow

**Problem Solved**: Creating pull requests across multiple repositories was time-consuming and error-prone, requiring manual navigation to each repository, branch checking, and URL construction.

**Solution**: `scripts/open-pr-links.js` - Automated script that detects repositories with changes and opens PR creation pages in the browser.

**Core Features**:
- **Smart Repository Detection**: Automatically finds repositories with changes on specified branch
- **Project Type Filtering**: Filter by project type (cpp, csharp, js, nexus, all)
- **Cross-Platform Browser Integration**: Works on Windows, macOS, and Linux
- **Dry-Run Mode**: Preview what would be opened without opening browsers
- **Staggered Opening**: Opens browser tabs with delays to prevent browser overwhelm
- **Error Handling**: Robust fallback mechanisms for browser opening
- **Integration**: Leverages existing MODULE_CONFIG and repository structure

**Script Architecture**:
```javascript
// Core functions with their responsibilities
async function hasChangesOnBranch(repoPath, branchName) {
  // Uses git to detect if repository has commits on specified branch
  // Returns boolean indicating if PR-worthy changes exist
}

async function openUrl(url) {
  // Cross-platform browser opening with Windows-specific handling
  // Multiple fallback commands for reliability
}

function getRepositoryUrl(moduleName) {
  // Constructs GitHub compare URL for PR creation
  // Format: https://github.com/Nexus-Mods/repo/compare/master...branch
}

function getProjectType(config) {
  // Determines project type from MODULE_CONFIG
  // Returns: 'cpp', 'csharp', 'nexus', 'js' based on repository characteristics
}
```

**Windows Browser Integration**:
```javascript
// Primary method with proper URL escaping for Windows
const command = `cmd /c start "" "${url}"`;
await execPromise(command);

// Fallback methods for maximum compatibility
const fallbackCommands = [
  `start "" "${url}"`,                                    // Direct start
  `explorer "${url}"`,                                    // Windows Explorer
  `rundll32 url.dll,FileProtocolHandler "${url}"`        // System URL handler
];
```

**Usage Examples**:
```bash
# Open PR creation pages for all C++ repositories with changes
yarn modules:open-prs vortex-integration-1759310854655 cpp

# Preview what would be opened without opening browsers
yarn modules:open-prs feature-branch cpp --dry-run

# Open for all project types
yarn modules:open-prs hotfix-branch all

# Check specific branch across all repositories
yarn modules:open-prs main
```

**Complete Workflow**:
```bash
# 1. Create feature branch and make changes across repositories
yarn modules:create-branch feature-header-integration
# ... make changes to binding.gyp files ...

# 2. Commit changes across all repositories
yarn modules:commit "Add header files to Visual Studio projects for better IntelliSense"

# 3. Push changes to remote repositories
yarn modules:push

# 4. Automatically open PR creation links for C++ projects only
yarn modules:open-prs feature-header-integration cpp

# 5. Complete PR creation in the opened browser tabs
```

**Integration with Existing Tools**:
- **MODULE_CONFIG Integration**: Uses existing repository configuration from `manage-node-modules.js`
- **Project Type Detection**: Leverages established project categorization system
- **Git Integration**: Uses standard git commands for change detection
- **Package.json Script**: Added as `modules:open-prs` for easy access
- **Error Handling**: Follows existing patterns for robust error management

**Time Savings**: This automation reduces PR creation from 15+ minutes of manual work to under 30 seconds, while eliminating human error and ensuring consistency across all repositories.

**Maintenance Notes**:
- Script automatically adapts to new repositories added to MODULE_CONFIG
- Project type filtering is extensible for new project categories
- Browser opening methods can be extended for additional platforms
- Change detection logic handles edge cases like empty branches and missing remotes

### Testing and Quality
- `yarn test` - Run Jest test suite
- `yarn lint` - Run ESLint with TypeScript support
- `yarn lint-to-file` - Output linting results to `./eslint.log`

### Production Builds
- `yarn dist` - Full production build creating installers (one-click and advanced)
- `yarn ci` - Create unsigned release build for CI
- `yarn package` - Build electron package without installer
- `yarn package:nocodesign` - Build unsigned installer using `electron-builder-config-nocodesign.json`

### Utility Commands
- `yarn check_packages` - Verify consistency between root and app package.json files
- `yarn update_aboutpage` - Update license information for About screen

## Architecture Overview

Vortex is an Electron-based mod manager with a Redux architecture:

### Core Structure
- **Main Process**: `src/main.ts` - Electron main process entry point
- **Renderer Process**: `src/renderer.tsx` - React UI entry point  
- **Extensions System**: Modular plugin architecture with both embedded (`src/extensions/`) and bundled (`extensions/`) extensions
- **State Management**: Redux with actions (`src/actions/`) and reducers (`src/reducers/`)

### Key Directories
- `src/` - Main TypeScript source code
- `extensions/` - Bundled extensions (dynamically loaded)
- `src/extensions/` - Embedded extensions (statically loaded)
- `src/controls/` - Reusable React components exposed via API
- `src/views/` - Main application UI views
- `src/util/` - Utility classes and helpers
- `src/types/` - TypeScript type definitions
- `app/` - Production build staging directory
- `out/` - Development build output

### Build System
- **Development**: TypeScript compiler (tsc) directly, files loaded individually
- **Production**: Webpack bundles everything into two files (main + renderer)
- **Extensions**: Always built with Webpack (except simple single-file game extensions)
- **Two package.json structure**: Root for development, `app/package.json` for release

### Extension Development
Extensions are the primary way to add functionality. They can be:
- Game-specific support (in `extensions/games/`)
- UI enhancements and tools
- Integration with external services

Use `yarn buildext` to build individual extensions during development.

### Technology Stack
- **Electron 37.4.0** with Node.js integration
- **React 16** with TypeScript
- **Redux** for state management  
- **Bootstrap/SASS** for styling
- **Jest** for testing
- **ESLint** for code quality
- **Yarn 1.x** for package management

### Development vs Production
Development builds are faster to compile but slower at runtime. Production builds use Webpack to bundle everything for optimal runtime performance but take longer to build.

### Native Dependencies
Many native modules are included. Run `yarn install` to build them, and check `postinstall.js` output for any build failures.

### Log Files
- **Development**: `%appdata%/vortex_devel` with a `.log` suffix
- **Production**: `%appdata%/vortex` with a `.log` suffix

## Electron Architecture & Startup

### Application Startup Sequence
1. `src/main.ts` - Entry point, initializes @electron/remote at line 249
2. `src/app/Application.ts` - Main application class constructor 
3. `src/app/SplashScreen.ts` - Shows loading screen with `nodeIntegration: true`
4. `src/app/MainWindow.ts` - Creates main window with security settings
5. `src/renderer.tsx` - Renderer process entry point

**Critical**: @electron/remote is initialized ONLY in `src/main.ts:249`. Do not initialize elsewhere.

### Security Configuration
**MainWindow** (`src/app/MainWindow.ts:312-319`):
```typescript
webPreferences: {
  nodeIntegration: true,         // Required for @electron/remote compatibility  
  nodeIntegrationInWorker: true,
  webviewTag: true,
  enableWebSQL: false,
  contextIsolation: false,       // Required for @electron/remote compatibility
  backgroundThrottling: false,
}
```

**SplashScreen** (`src/app/SplashScreen.ts:76-82`):
```typescript
webPreferences: {
  nodeIntegration: true,         // Legacy - required for splash functionality
  sandbox: false,
  backgroundThrottling: false,
}
```

### @electron/remote Setup (Required for Electron 37)
- **Initialization**: `src/main.ts:249` - `require('@electron/remote/main').initialize()`
- **MainWindow Enable**: `src/app/MainWindow.ts:101` - `require('@electron/remote/main').enable(this.mWindow.webContents)`
- **SplashScreen Enable**: `src/app/SplashScreen.ts:86` - `require('@electron/remote/main').enable(this.mWindow.webContents)`

### Common Startup Issues
- **"@electron/remote has already been initialized"**: ✅ FIXED - Added try/catch guard in `src/main.ts:249`
- **ERR_FILE_NOT_FOUND for index.html**: ✅ FIXED - Added path check in `src/util/getVortexPath.ts:45`
- **"Uncaught ReferenceError: require is not defined"**: ✅ FIXED - Ensured `nodeIntegration: true` in MainWindow webPreferences
- **Main window not showing**: ✅ FIXED - All Electron 37 compatibility issues resolved
- **Remote calls failing**: Ensure `enable()` is called for each BrowserWindow after creation
- **Security errors**: Verify `contextIsolation: false` for @electron/remote compatibility
- **App starts and immediately exits**: Check for file path issues and window creation logic
- **F5 debugging causes double initialization**: VS Code may initialize @electron/remote during debugging

### Fixed Issues for Electron 37
1. **Double path issue**: `app.getAppPath()` in Electron 37 returns `C:\work\Vortex\out`, causing double `out/out/index.html`
   - Fixed in `src/util/getVortexPath.ts:42-51` by checking if basePath already ends with 'out'
2. **@electron/remote initialization**: Added error handling for multiple initialization attempts
   - Fixed in `src/main.ts:249-256` with try/catch guard for duplicate initialization
3. **"require is not defined" error**: Main window failed to load due to missing nodeIntegration
   - Fixed by ensuring `nodeIntegration: true` in MainWindow webPreferences (line 313)
4. **File.path deprecated**: `File.path` property removed from dropped files in Electron 37+
   - Fixed in `src/controls/Dropzone.tsx:202` by using `webUtils.getPathForFile()` instead
   - **Breaking change**: `evt.dataTransfer.files.item(i).path` → `webUtils.getPathForFile(evt.dataTransfer.files.item(i))`
5. **url.format() deprecated**: Node.js `url.format()` removed in newer Node.js versions with Electron 37+
   - Fixed in `src/util/util.ts:890` by using string concatenation instead of `url.format()`
   - Fixed in `tools/addicons/main.js:14` by using `pathToFileURL().href` instead
   - **Breaking change**: `url.format(urlObj)` → `pathToFileURL(filePath).href` or manual string building
6. **Security configuration**: Balanced security with @electron/remote compatibility
7. **VS Code debugging**: Fixed launch.json to work with newer Electron debugging protocol
   - Separated runtimeArgs from args to prevent duplicate argument passing

**Result**: ✅ Vortex now starts successfully with Electron 37.4.0 and main window displays properly

### Files with @electron/remote Usage (27+ files)
**High Priority**:
- `src/renderer.tsx:82` - Main renderer process
- `src/util/menu.ts:7` - Application menu system  
- `src/util/errorHandling.ts:16` - Error dialogs
- `src/views/WindowControls.tsx:1` - Window management
- `src/views/Dialog.tsx:18` - Dialog system

**Medium Priority**:
- Extension files in `src/extensions/` and `extensions/` directories
- Game extension files (`extensions/games/game-*/index.js`)

### Migration Notes
When migrating away from @electron/remote:
1. Replace with IPC communication (`ipcMain`/`ipcRenderer`)
2. Create preload scripts for secure context bridge
3. Enable `contextIsolation: true` and `nodeIntegration: false`
4. Test thoroughly - @electron/remote is deeply integrated

## VS Code Debugging (F5)

### Updated Configuration for Electron 37
The `.vscode/launch.json` has been updated to work with Electron 37's debugging changes:

**Main Process Debugging**:
```json
"runtimeArgs": [
  "--inspect=9229",
  "--remote-debugging-port=9222"
],
"args": [
  "."
],
"outFiles": [
  "${workspaceFolder}/out/**/*.js"
],
"resolveSourceMapLocations": [
  "${workspaceFolder}/**",
  "!**/node_modules/**"
]
```

**Renderer Process Debugging**:
```json
"port": 9222,  // Changed from 9230
"webRoot": "${workspaceFolder}",
"sourceMapPathOverrides": {
  "webpack:///./*": "${workspaceFolder}/*"
}
```

### Usage
- **F5** or "Debug Electron" compound - Debugs both main and renderer
- **Main Process only** - Set breakpoints in `src/main.ts`, `src/app/*.ts`  
- **Renderer Process** - Set breakpoints in `src/renderer.tsx`, `src/views/*.tsx`
- **Build first** - Always run `yarn build` before debugging

### Troubleshooting F5 Debug Issues
- Ensure `yarn build` completed successfully
- Check `out/main.js` exists and is recent
- Verify Electron 37 is installed: `node_modules/.bin/electron --version`
- Try "Debug Main Process" alone first, then add renderer debugging
- **Fixed Issue**: Separated `runtimeArgs` and `args` to prevent VS Code from passing duplicate arguments

### Common F5 Debug Problems
- **"Waiting for debugger to disconnect"**: VS Code was passing extra arguments, fixed by separating runtime args
- **Breakpoints not hitting**: Ensure source maps are enabled and `yarn build` was recent
- **Process hangs on startup**: Check that no other Electron instance is running on debug ports

## Testing

### Test Structure
- **Root-level tests**: `__tests__/` directory at project root for integration and cross-cutting tests
- **Module-specific tests**: `src/**/__tests__/` for unit tests colocated with source code
- **Test runner**: Jest with TypeScript support

### Test File Locations and Import Paths
When writing or moving test files, pay careful attention to relative paths:

**Root-level tests** (`__tests__/*.test.ts`):
```typescript
// Correct imports from root __tests__/
import InstallManager from '../src/extensions/mod_management/InstallManager';
import { IExtensionApi } from '../src/types/api';

// Correct jest.mock paths from root __tests__/
jest.mock('../src/extensions/mod_management/util/dependencies');
jest.mock('../src/util/api');
jest.mock('../src/util/log');
```

**Module-specific tests** (`src/extensions/mod_management/__tests__/*.test.ts`):
```typescript
// Correct imports from module __tests__/
import InstallManager from '../InstallManager';
import { IExtensionApi } from '../../../types/api';

// Correct jest.mock paths from module __tests__/
jest.mock('../util/dependencies');
jest.mock('../../../util/api');
jest.mock('../../../util/log');
```

### Common Test Issues
- **"Cannot find module" errors**: Check that `jest.mock()` paths match the actual file location relative to the test file
- **Import paths vs jest.mock paths**: Import paths and jest.mock paths must both be updated when moving test files
- **Missing mock parameters**: When method signatures change, ensure all test mock calls include required parameters

### Running Tests
- `yarn test` - Run all tests
- `yarn test <path>` - Run specific test file or directory
- `yarn test --watch` - Run tests in watch mode
- Tests automatically run with `--no-cache` to prevent stale mock issues

## Collections & Phased Installation System

### Overview
Vortex supports **Collections** - curated sets of mods that install in a specific order with dependency management. The phased installation system ensures mods install sequentially and can have dependencies that must be installed first.

### Key Concepts

**Phase-Gated Installation**: Mods are organized into numbered phases (0, 1, 2, 3...). Each phase must complete before the next begins:
- Phase 0: Usually framework mods (e.g., SMAPI for Stardew Valley)
- Phase 1+: Content mods that depend on Phase 0
- Phase N: Mods that depend on Phase N-1

**Deployment Blocking**: During deployment (applying mods to the game directory), new mod installations must be blocked to prevent file conflicts and race conditions.

**Collection Session State**: Redux state tracking which mods are in which phase and their installation status.

### Core Implementation: InstallManager.ts

**Location**: `src/extensions/mod_management/InstallManager.ts` (5000+ lines)

**Key Methods**:

1. **`ensurePhaseState(sourceModId: string)`** - Initialize phase tracking for a collection
   - Creates tracking maps for active/pending installations per phase
   - Sets up deployment scheduling and re-queue prevention

2. **`markPhaseDownloadsFinished(sourceModId: string, phase: number, api: IExtensionApi)`** - Called when downloads for a phase complete
   - Marks phase as ready for installation
   - Sets `allowedPhase` if this is the first phase
   - Calls `maybeAdvancePhase()` to check if we can progress

3. **`maybeAdvancePhase(sourceModId: string, api: IExtensionApi)`** - Attempts to advance to next phase
   - Checks if current phase is deployed
   - Verifies no active installations in current phase
   - Advances `allowedPhase` to next incomplete phase
   - Starts pending installations for newly-allowed phase

4. **`scheduleDeployOnPhaseSettled(api, sourceModId, phaseNum)`** - Schedules deployment when phase completes
   - Called with `options.deployOnSettle = true`
   - Sets `isDeploying` flag to block new installations
   - Runs deployment, then clears flag and resumes installations

5. **`startPendingForPhase(sourceModId: string, phase: number)`** - Starts queued installations for a phase
   - Called when phase becomes allowed or after deployment completes

**Phase State Structure** (line ~1838):
```typescript
private mInstallPhaseState: Map<string, {
  allowedPhase?: number;                           // Current phase that can install
  downloadsFinished: Set<number>;                  // Phases with completed downloads
  pendingByPhase: Map<number, Array<() => void>>;  // Queued installs per phase
  activeByPhase: Map<number, number>;              // Active install count per phase
  scheduledDeploy: Set<number>;                    // Phases scheduled for deployment
  deployedPhases: Set<number>;                     // Phases that have been deployed
  reQueueAttempted?: Map<number, number>;          // Re-queue attempt tracking
  deploymentPromises?: Promise<void>[];            // Pending deployment operations
  isDeploying?: boolean;                           // CRITICAL: Blocks installs during deployment
}> = new Map();
```

### Deployment Blocking Pattern

**Problem**: Installations were starting while deployment events were running, causing race conditions and file conflicts.

**Solution** (lines 1704-1713, 1939-1951):
```typescript
// Check if deployment is blocking installations
const canStartWithoutDeploymentBlock = canStartNow && !phaseState.isDeploying;

// When deploying, set flag and clear it after
if (options.deployOnSettle) {
  if (phaseState) {
    phaseState.isDeploying = true;  // BLOCK new installations
  }

  toPromise(cb => api.events.emit('deploy-mods', cb))
    .then(() => {
      if (phaseState) {
        phaseState.isDeploying = false;  // UNBLOCK installations
        this.startPendingForPhase(sourceModId, checkPhase);  // Start queued installs
        this.maybeAdvancePhase(sourceModId, api);  // Check if we can advance
      }
    });
}
```

**Critical**: Never remove the `isDeploying` check or change `installationsComplete` to ignore pending installations.

### Phase Completion Logic (lines 1927-1932)

```typescript
// A phase is complete when:
// 1. Collection session marks phase as logically complete (all downloads processed)
const phaseLogicallyComplete = collectionStatus.phaseComplete;

// 2. AND no active installations running
// 3. AND no pending installations waiting
const installationsComplete = active === 0 && pending === 0;

if (phaseLogicallyComplete && installationsComplete) {
  // Safe to deploy this phase
}
```

**Important**: Both `active === 0` AND `pending === 0` must be checked. Checking only `active === 0` allows deployment to run while installations are queued, causing race conditions.

### Common Pitfalls

❌ **Don't bypass phase gating for optional mods** - This breaks the last phase advancement logic

❌ **Don't check only `active === 0`** - Must check both active and pending to prevent deployment race conditions

❌ **Don't start all pending phases at once** - This bypasses phase gating and causes chaos

❌ **Don't remove the `isDeploying` flag** - It's critical for preventing installation/deployment conflicts

✅ **Do respect phase gates** - Even optional/recommended mods must wait for their phase

✅ **Do check both active and pending** - Before allowing deployment or phase advancement

✅ **Do use the `isDeploying` flag** - Always set it during deployment and clear it after

✅ **Do call `startPendingForPhase()` after deployment** - Resume queued installations after deployment completes

### Refactoring Patterns

When refactoring InstallManager.ts, several patterns have been extracted into helper functions:

**Activity Tracking** (lines 316-332):
```typescript
private withActivityTracking<T>(
  api: IExtensionApi,
  activityId: string,
  message: string,
  promise: Promise<T>
): Promise<T> {
  // Wraps promise with startActivity/stopActivity
}
```

**Collection Lookup** (lines 334-348):
```typescript
private findCollectionByDownloadTag(
  api: IExtensionApi,
  downloadId: string
): { collectionId: string; collectionName: string } | undefined {
  // Finds collection from download reference
}
```

**Dependency Filtering** (lines 350-364):
```typescript
private filterDependencyRules(
  modRules: IModRule[],
  type: 'requires' | 'recommends'
): IModRule[] {
  // Filters rules by type, excluding incompatibilities
}
```

**Cancellation Check** (lines 366-388):
```typescript
private checkAndEmitDependencyInstallStart(
  api: IExtensionApi,
  downloadId: string,
  collectionId: string,
  collectionName: string
): boolean {
  // Checks if user cancelled, emits events
}
```

### Testing Collections

**Test Files**:
- `__tests__/PhasedInstaller.test.ts` - Unit tests for phase advancement logic (19 tests)
- `__tests__/CollectionIntegration.test.ts` - Integration tests with real collection data (5 tests)

**Key Test Patterns**:
```typescript
// Always pass mockApi to methods that require it
installManager.maybeAdvancePhase(sourceModId, mockApi);
installManager.markPhaseDownloadsFinished(sourceModId, phase, mockApi);

// Mock collection session state for testing
mockState.session.collections = {
  activeSession: {
    mods: {
      'mod-id': { phase: 1, type: 'requires', status: 'pending' }
    }
  }
};
```

**When Tests Fail After Refactoring**:
1. Check if method signatures changed (e.g., added required parameters)
2. Update all test calls to include new required parameters
3. Verify jest.mock paths are correct for test file location
4. Don't modify InstallManager unless absolutely necessary - fix tests first

## GitHub Actions Workflows

### Package Workflow (.github/workflows/package.yml)
- **No-code-sign builds**: Supports both signed and unsigned builds via `use-codesigning` parameter
- **Optimized flow**: Tests run before packaging to catch issues early
- **Validation**: Automatically validates that installer and metadata files were created successfully
- **Clear step names**: Updated for better understanding of build process