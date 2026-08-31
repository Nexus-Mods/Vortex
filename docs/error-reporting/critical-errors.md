# Critical Error Handling

Two separate `terminate` paths exist — one in the renderer process and one in the main process. Both send an OTel crash span to the collector.

## Main-Process Crash

**Entry**: `terminate(error, allowReport?)` / `terminateAsync()` in `src/main/src/errorHandling.ts`

Called for errors in the main process (e.g. extension loading failures). See [Known Crash Triggers](#known-crash-triggers) for more examples.

### Reporting Gate

- `allowReport` defaults to `true` only when `error.extension === "Black Tree Gaming Ltd."` (first-party errors only)
- `isErrorReportingDisabled()` → `allowReport = false`

### Dialog

Same button set. **"Report and Quit"** calls `reportCrash("Crash", errorToReportableError(error))` directly (no subprocess), then `app.exit(1)`.

### Extension Disable Flow

When `error.extension` is set, after the main dialog the user is asked whether to disable the extension. Confirmed → writes `<temp>/__disable_<extension>` marker file; Vortex skips the extension on next startup.

## Renderer-Process Crash

**Entry**: `terminate(error, state, allowReport?)` in `src/renderer/src/util/errorHandling.ts`

Called when the renderer detects unrecoverable state (e.g. Redux reducer failure). See [Known Crash Triggers](#known-crash-triggers) for more examples.

### Dialog

Shows: **[Show Details]** **[Ignore]** **[Quit]** **[Report and Quit]**

- **Show Details** — re-shows with full stack trace
- **Ignore** — confirmation dialog; if confirmed: `errorIgnored = true`, app continues
- **Quit** — exits immediately
- **Report and Quit** — calls `createErrorReport()`, then exits

"Report and Quit" only appears when `allowReport !== false && !outdated && !errorIgnored`.

### Crash Reporter Subprocess

`createErrorReport()` (`src/renderer/src/util/errorHandling.ts`):

1. Writes `<userData>/crashinfo.json`
2. Calls `spawnSelf(["--report", path])` if `isTelemetryEnabled(state)` is true

The subprocess runs `main.ts` → detects `--report` → `sendReportFile()` in `src/main/src/errorReporting.ts` → `reportCrash()` → OTel.

## `reportCrash()`

`src/main/src/errorReporting.ts` — both crash paths converge here. See [telemetry-otel.md](telemetry-otel.md#crash-reporter-subprocess) for implementation details.

## Error Reporting State (Main)

`errorReportingDisabled` flag in `src/main/src/errorReporting.ts`. Set by `disableErrorReporting()` when the user confirms "Ignore". Suppresses the "Report and Quit" button in future dialogs within the same session.

Separate from the renderer-side `errorIgnored` flag in `src/renderer/src/util/errorHandling.ts`, which suppresses OTel recording from `showError()`.

## Known Crash Triggers

### Main Process — `terminate()`

| File                                      | Trigger                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main/src/main.ts`                    | `uncaughtException` / `unhandledRejection` during startup (after app ready); filtered through `Application.shouldIgnoreError()`       |
| `src/main/src/Application.ts`             | `uncaughtException` / `unhandledRejection` during normal operation (replaces the startup handler once persistence is set up)          |
| `src/main/src/Application.ts`             | Startup failure that is not `UserCanceled`, `ProcessCanceled`, `DocumentsPathMissing`, `database:locked`, or `database:open-failed`   |
| `src/main/src/store/ReduxPersistorIPC.ts` | Disk-full error during state write (`IO error: ...Append: cannot write`) — user-friendly message; `allowReport = undefined` (default) |
| `src/main/src/store/ReduxPersistorIPC.ts` | Any other persistence write failure — `allowReport = true`                                                                            |
| `src/main/src/MainWindow.ts`              | Renderer emits a console error but the window has not shown within 15 seconds — `allowReport = true`                                  |

### Main Process — `app.exit()` (no dialog)

| File                          | Trigger                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/main/src/main.ts`        | `uncaughtException` / `unhandledRejection` during pre-app-ready startup; shows a native error box then exits immediately |
| `src/main/src/Application.ts` | `UserCanceled` thrown during startup                                                                                     |
| `src/main/src/Application.ts` | Renderer signals it finished loading but the main window was never created                                               |
| `src/main/src/Application.ts` | Exception thrown while attempting to show the main window and the window reference is null                               |
| `src/main/src/ipcHandlers.ts` | Renderer requests exit via `app:exit` IPC — used for normal controlled shutdown                                          |

### Main Process — `process.exit()` (no dialog)

| File                         | Trigger                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/main/src/MainWindow.ts` | Renderer process crashes (`render-process-gone`) with a reason other than `"killed"`, and the window reference is already null |

### Renderer Process — `terminate()`

| File                                                                  | Trigger                                                                                                                    |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/src/renderer.tsx`                                       | `uncaughtException` / `unhandledRejection` global handler                                                                  |
| `src/renderer/src/extensions/mod_management/InstallManager.ts`        | Attempt to change download state with a duplicate or invalid ID — `allowReport = false` (programming error, not user data) |
| `extensions/gamebryo-plugin-management/src/util/UserlistPersistor.ts` | Cannot read the userlist file even though it exists — `allowReport = false`; user directed to repair or delete the file    |

### Renderer Process — direct exit (no dialog)

| File                                 | Trigger                                                                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/src/renderer.tsx`      | Very early unhandled error before the full error handler is set up; shows a native error box via preload, then calls `window.api.app.exit(1)` |
| `src/renderer/src/reducers/index.ts` | Redux state sanity check fails and decision is `QUIT`; calls `window.api.app.exit()`                                                          |

### `createErrorReport()` call sites (spawns crash reporter subprocess)

| File                                                           | Trigger                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/renderer/src/util/errorHandling.ts`                       | User clicks "Report and Quit" in the renderer terminal error dialog                              |
| `src/renderer/src/util/fs.ts`                                  | Native filesystem error where user clicks "Cancel and Report" — collects Windows API error codes |
| `src/renderer/src/extensions/mod_management/InstallManager.ts` | FOMOD installer calls an unimplemented function during installation                              |
