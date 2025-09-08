# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Building and Development
- `yarn build` - Build project for development (TypeScript compilation to `out/`)
- `yarn buildwatch` - Build and watch for changes during development
- `yarn start` - Start Vortex in development mode
- `yarn subprojects` - Build only bundled extensions
- `yarn buildext` - Build a single extension using `./tools/buildScripts/buildSingleExtension.js`

### Testing and Quality
- `yarn test` - Run Jest test suite
- `yarn lint` - Run ESLint with TypeScript support
- `yarn lint-to-file` - Output linting results to `./eslint.log`

### Production Builds
- `yarn dist` - Full production build creating installers (one-click and advanced)
- `yarn ci` - Create unsigned release build for CI
- `yarn package` - Build electron package without installer

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