# Vortex Debugging Guide

This guide covers various methods for debugging Vortex, from simple console logging to advanced debugging techniques with breakpoints and inspection tools. It assumes you can build Vortex per `CONTRIBUTE.md`.

---

## Table of Contents

1. [VS Code Debugging](#vs-code-debugging)
2. [Log Files](#log-files)
3. [Console Debugging](#console-debugging)
4. [Chrome DevTools](#chrome-devtools)
5. [Redux DevTools](#redux-devtools)
6. [Production Build Debugging](#production-build-debugging)
7. [Native Module Debugging](#native-module-debugging)
8. [Common Issues](#common-issues)
9. [Performance Debugging](#performance-debugging)

---

## VS Code Debugging

The recommended workflow is VS Code's integrated debugger. Use **Debug Electron** (F5) to launch both processes together, or switch to **Debug Main Process** / **Debug Renderer Process** when you only need one side.

### Recommended: Debug Electron (F5)

```bash
# 1. Build the project first
yarn build

# 2. Ensure out/main.js exists
ls out/main.js
```

1. Open VS Code in the Vortex project root
2. Press **F5** or select **Debug Electron**
3. Vortex launches with debuggers attached to both main and renderer processes

### Set Breakpoints

- **Main Process**: Set breakpoints in `src/main.ts`, `src/app/*.ts`
- **Renderer Process**: Set breakpoints in `src/renderer.tsx`, `src/views/*.tsx`, `src/extensions/**/*.ts`

### Debug Configuration

VS Code debug configurations are defined in `.vscode/launch.json`. The default **Debug Electron** profile is a compound that starts:

- **Debug Main Process** (launches Electron with `NODE_ENV=development`, `START_DEVTOOLS=true`, and `--remote-debugging-port=9222`)
- **Debug Renderer Process** (attaches to the renderer on port `9222`)

**Important Notes:**

- Always run `yarn build` before debugging to ensure source maps are current
- If breakpoints aren't hitting, check that `out/` directory has recent files
- The renderer attach profile needs a running Electron instance with `--remote-debugging-port=9222` (provided by the main-process profiles or `yarn start`)

### Debug Configurations (Profiles)

#### Core Profiles

| Profile                | Purpose                                      | Notes                                                               |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| Debug Electron         | Launches main + renderer (compound)          | **Recommended**; default F5 workflow                                |
| Debug Main Process     | Launches Electron main process only          | Good for startup, IPC, filesystem, updater work                     |
| Debug Renderer Process | Attaches to renderer on port `9222`          | Start the main process first (`Debug Main Process` or `yarn start`) |
| Debug Jest Tests       | Launches Jest with the args in `launch.json` | Update args per test                                                |

#### Special Modes (Optional)

| Profile                      | Purpose                              | Notes                                                                     |
| ---------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| Debug Electron (Staging)     | Main + renderer with preview updater | Sets `IS_PREVIEW_BUILD=true` to test release updates via [Vortex-Staging] |
| Debug Main Process (Staging) | Main only with preview updater       | Same as above                                                             |

### Staging

- **Staging**: Preview build mode used to test release updates via [Vortex-Staging].

The update channel named `next` is unrelated and is forced back to `beta`, so it doesn't affect staging.

### Debug Only One Process (Optional)

- **Main only** for app lifecycle, IPC, filesystem, auto-updater, and extension loading.
- **Renderer only** for React/Redux UI behavior without stepping through main-process code.
- **Single-process** debugging reduces noise when one side is noisy or restarting.

### Debugging Main Process Only

Use **Debug Main Process** (or its staging variant) when you want to inspect startup, IPC, or background logic without attaching to the renderer. It launches Electron and also enables the renderer debugging port (`9222`) so you can attach later if needed.

### Debugging Renderer Process Only

1. Start Vortex with **Debug Main Process**, **Debug Main Process (Staging)**, or `yarn start`.
2. Launch **Debug Renderer Process** to attach to port `9222`.
3. Set breakpoints in `src/renderer.tsx`, `src/views/*.tsx`, and `src/extensions/**/*.ts`.

### Debug Actions

While debugging in VS Code:

- **Step Over** (F10): Execute current line, don't enter functions
- **Step Into** (F11): Enter function calls
- **Step Out** (Shift+F11): Exit current function
- **Continue** (F5): Resume execution until next breakpoint
- **Restart** (Ctrl+Shift+F5): Restart debugging session
- **Stop** (Shift+F5): Stop debugging

### Watch Expressions

Add expressions to watch in the Debug sidebar:

```typescript
// Watch variable values
download.state;
(download.received / download.size) * 100;

// Watch Redux state
store.getState().persistent.downloads.files[downloadId];

// Watch complex expressions
Object.keys(downloads).filter((id) => downloads[id].state === "active").length;
```

### Debug Console

Execute code in the current execution context:

```typescript
// Change variable values
download.state = "paused";

// Call functions
this.pauseDownload(downloadId);

// Inspect objects
JSON.stringify(download, null, 2);
```

---

## Log Files

Vortex writes detailed logs that are invaluable for debugging.

### Log Locations

**Development Build:**

```
%appdata%/vortex_devel/*.log
```

**Production Build:**

```
%appdata%/vortex/*.log
```

### Log Levels

- `[DEBG]` - Debug information (verbose)
- `[INFO]` - Informational messages
- `[WARN]` - Warnings (non-fatal issues)
- `[ERRO]` - Errors (may cause failures)

### Reading Logs

```powershell
# Tail the latest log file (PowerShell)
Get-Content "$env:APPDATA\vortex_devel\vortex0.log" -Wait -Tail 50

# Filter for errors only
Get-Content "$env:APPDATA\vortex_devel\vortex0.log" | Select-String "ERRO"

# Search for specific keyword
Get-Content "$env:APPDATA\vortex_devel\vortex0.log" | Select-String "download"
```

### Adding Log Statements

```typescript
import { log } from "../../util/log";

// Debug logging (verbose)
log("debug", "processing download", { id: downloadId, size: fileSize });

// Info logging
log("info", "download completed", { id: downloadId });

// Warning logging
log("warn", "download had errors", { id: downloadId, error: err.message });

// Error logging
log("error", "download failed", {
    id: downloadId,
    error: err.message,
    stack: err.stack,
});
```

**Best Practices:**

- Include relevant context as the second parameter object
- Use appropriate log levels
- Don't log sensitive information (passwords, API keys)
- Log state transitions and important decisions

---

## Console Debugging

### Opening DevTools

**During Development:**

- Press **F12** or **Ctrl+Shift+I** in the running Vortex window
- Or add to your code: `require('@electron/remote').getCurrentWindow().webContents.openDevTools()`

**From Command Line:**

```bash
# Start with DevTools open
yarn start -- --devtools
```

### Console Logging

```typescript
// Basic console logging
console.log("Download started:", downloadId);
console.warn("Download paused:", downloadId);
console.error("Download failed:", err);

// Table view for objects
console.table({ id: downloadId, size: fileSize, state: "active" });

// Group related logs
console.group("Download Process");
console.log("Starting download");
console.log("Chunks:", chunks);
console.groupEnd();

// Timing operations
console.time("download-md5");
await calculateMD5(file);
console.timeEnd("download-md5");
```

### Redux State Inspection

Access the entire Redux state from console:

```javascript
// Get current state
const state = window.store.getState();

// Inspect downloads
state.persistent.downloads.files;

// Inspect mods
state.persistent.mods["skyrimse"];

// Inspect current profile
state.persistent.profiles[state.settings.profiles.activeProfileId];
```

---

## Chrome DevTools

Vortex uses Electron, which provides Chrome DevTools for debugging.

### Opening DevTools Programmatically

```typescript
// In main process
import { BrowserWindow } from "electron";
BrowserWindow.getFocusedWindow()?.webContents.openDevTools();

// In renderer process
require("@electron/remote").getCurrentWindow().webContents.openDevTools();
```

### Network Tab

Monitor network requests:

1. Open DevTools (F12)
2. Go to **Network** tab
3. Reload or perform action
4. Inspect requests, responses, timing

Useful for debugging:

- Nexus API calls
- Download requests
- GraphQL queries

### Performance Tab

Record and analyze performance:

1. Open DevTools (F12)
2. Go to **Performance** tab
3. Click **Record**
4. Perform action to profile
5. Click **Stop**
6. Analyze flame graph

Look for:

- Long-running operations
- Excessive re-renders
- Memory leaks

### Memory Tab

Diagnose memory issues:

1. Open DevTools (F12)
2. Go to **Memory** tab
3. Take **Heap Snapshot**
4. Perform actions
5. Take another snapshot
6. Compare snapshots

Look for:

- Detached DOM nodes
- Growing object counts
- Leaked listeners

### Application Tab

Inspect storage:

- **Local Storage**: User preferences
- **Session Storage**: Temporary data
- **IndexedDB**: Large structured data
- **Cookies**: Authentication tokens

---

## Redux DevTools

Vortex uses Redux for state management. Redux DevTools Extension provides powerful debugging.

### Setup

The Redux DevTools integration is in [src/util/reduxDevTools.ts](src/util/reduxDevTools.ts).

### Features

**Action History:**

- See all dispatched actions in chronological order
- Jump to any point in time
- Inspect action payloads

**State Diff:**

- See what changed after each action
- Compare states at different points

**Time Travel:**

- Replay actions
- Skip actions
- Revert to previous states

**Action Filtering:**

```typescript
// In Redux DevTools, filter actions
@@INIT
DOWNLOAD_*
MOD_*
```

### Common State Paths

```typescript
// Downloads
state.persistent.downloads.files;
state.persistent.downloads.files[downloadId];

// Mods
state.persistent.mods[gameId];
state.persistent.mods[gameId][modId];

// Profiles
state.persistent.profiles[profileId];
state.settings.profiles.activeProfileId;

// Game mode
state.settings.gameMode.current;

// UI state
state.session.base.activity;
state.session.notifications.notifications;
```

---

## Production Build Debugging

Sometimes issues only occur in production builds. Here's how to debug them.

### Build Production (Unsigned)

```bash
# Build without code signing (faster)
yarn build_dist:local
```

This creates an installer in `dist/` directory.

### Enable Source Maps

Production builds use webpack which creates source maps. Ensure they're not excluded:

```bash
# Check webpack config includes source maps
cat webpack.config.js | grep "devtool"
```

### Debug Production Build

1. Install the production build
2. Launch from command line with DevTools:

```bash
# Windows
"C:\Program Files\Black Tree Gaming Ltd\Vortex\Vortex.exe" --remote-debugging-port=9222

# Then attach Chrome DevTools
chrome://inspect
```

### Production Logs

Production logs are in:

```
%appdata%/vortex/vortex0.log
```

### C++ Native Modules

**Projects:**

- winapi-bindings
- bsatk
- esptk
- loot
- gamebryo-savegame
- bsdiff-node

**Debugging with Visual Studio:**

1. Build in Debug mode:

```bash
cd node_modules/winapi-bindings
node-gyp rebuild --debug
```

2. Attach Visual Studio debugger:
    - Debug → Attach to Process
    - Select `electron.exe`
    - Set breakpoints in `.cpp` files

3. Debug symbols location:

```
node_modules/<module>/build/Debug/<module>.pdb
```

### Native Module Crashes

If a native module crashes:

1. Check log files for stack traces
2. Look for `EXCEPTION_ACCESS_VIOLATION` errors
3. Check Windows Event Viewer:
    - Run `eventvwr.msc`
    - Windows Logs → Application
    - Look for errors from `electron.exe` or `Vortex.exe`

---

## Common Issues

### Breakpoints Not Hitting

**Symptom:** Breakpoints show as gray circles or aren't triggered.

**Solutions:**

1. Rebuild the project: `yarn build`
2. Check source maps exist in `out/` directory
3. Verify `outFiles` in launch.json matches build output
4. Clear VS Code breakpoint cache: Restart VS Code
5. Check file path matches (Windows path separators)

### "Cannot find module" Errors

**Symptom:** Import errors when debugging.

**Solutions:**

1. Run `yarn install` to ensure all dependencies
2. Check `NODE_PATH` environment variable
3. Rebuild native modules: `yarn install --force`
4. Clear cache: Delete `node_modules/`

### Debugging Freezes/Hangs

**Symptom:** Debugger becomes unresponsive.

**Solutions:**

1. Increase timeout in launch.json:

```json
"timeout": 60000
```

2. Reduce logging verbosity
3. Disable Redux DevTools temporarily
4. Check for infinite loops or blocking operations

### Redux State Corruption

**Symptom:** Unexpected state values or crashes.

**Debug Steps:**

1. Enable Redux DevTools
2. Find the action that caused corruption
3. Inspect action payload
4. Check reducer logic
5. Verify immutability (no direct state mutation)

---

## Performance Debugging

### React Performance

**React DevTools Profiler:**

1. Install React DevTools extension
2. Open Vortex
3. Go to React DevTools → Profiler tab
4. Click Record
5. Perform action
6. Stop recording
7. Analyze component render times

**Common Issues:**

- Unnecessary re-renders
- Large list rendering without virtualization
- Heavy computations in render

**Solutions:**

```typescript
// Use React.memo for expensive components
export default React.memo(MyComponent);

// Use useMemo for expensive calculations
const sortedMods = useMemo(
    () => mods.sort((a, b) => a.name.localeCompare(b.name)),
    [mods],
);

// Use useCallback for callback functions
const handleClick = useCallback(() => {
    doSomething(id);
}, [id]);
```

### Startup Performance

**Measure startup time:**

1. Add timing code:

```typescript
// In src/main.ts
console.time("startup");
// ... startup code ...
console.timeEnd("startup");
```

2. Check `postinstall.js` for native module build times
3. Profile extension loading in ExtensionManager

### Slow Operations

**Profile with console.time:**

```typescript
console.time("operation-name");
await slowOperation();
console.timeEnd("operation-name"); // Logs: "operation-name: 1234ms"
```

**Chrome DevTools Performance Tab:**

1. Start recording
2. Perform slow operation
3. Stop recording
4. Analyze flame graph for bottlenecks

## Advanced Debugging Tools

### Remote Debugging

Debug Vortex running on another machine:

```bash
# On remote machine
vortex.exe --remote-debugging-port=9222

# On your machine
chrome://inspect
# Click "Configure" and add remote machine IP:9222
```

### Tracing

Enable Electron tracing:

```typescript
// In main process
import { contentTracing } from "electron";

contentTracing.startRecording(
    {
        include_categories: ["*"],
    },
    () => {
        console.log("Tracing started");

        setTimeout(() => {
            contentTracing.stopRecording("", (path) => {
                console.log("Trace saved to:", path);
            });
        }, 5000);
    },
);
```

View traces at: `chrome://tracing`

[Vortex-Staging]: https://github.com/Nexus-Mods/Vortex-Staging
