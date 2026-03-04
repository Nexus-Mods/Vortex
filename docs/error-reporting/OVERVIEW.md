# Error Reporting — Overview

## Two Kinds of Errors

**Non-critical** — Recoverable. Vortex keeps running and shows a toast notification. If the error qualifies, a record is sent silently in the background without user interaction.

**Critical** — Unrecoverable. Vortex shows a modal dialog and exits. The user can optionally send a crash report before quitting.

## What Gets Reported

- Error message and stack trace
- Vortex version and OS
- What the user was doing at the time (active game, operation in progress)
- A short fingerprint of the stack trace for grouping identical errors on the backend

Log files are not sent automatically.

## When Reporting Is Suppressed

- Analytics disabled in Vortex settings
- Vortex is outdated (errors in old versions aren't actionable)
- User previously clicked "Ignore" on a critical error (app may be in unknown state)
- Error came from a third-party extension (directed to extension's issue tracker instead)
- Error is a user cancellation
- Error is a transient network condition (timeout, connection refused, etc.)

## User Consent

Tied to the **Analytics** toggle in Vortex preferences.

- **Off** — no data is ever transmitted, including for crashes
- **On** — non-critical errors report silently; critical errors offer a "Report and Quit" button
- Setting takes effect immediately

## Known Error Triggers

### Non-Critical (reported silently, app continues)

**Downloads**
- Download start or resume failure (SSL mismatch, timeout, disk error, data corruption)
- Download path move fails (permissions, I/O, corrupted files)

**Mod installation and deployment**
- Deploy or purge fails (filesystem errors, no deployment method configured)

**Network and authentication**
- OAuth login failure
- NXM protocol handler registration fails

**UI and settings**
- Theme cloning fails
- Category sorting or visibility change fails
- Tool or game missing/misconfigured when launching

**Diagnostics**
- Failed to read or write log files
- Feedback attachment too large or submission fails

**Savegame management**
- Failed to load or refresh savegame list

Not all of these are reported — see [When Reporting Is Suppressed](#when-reporting-is-suppressed). For file locations see [non-critical-errors.md](non-critical-errors.md).

### Critical (dialog shown, app exits)

**Main process**
- Unhandled exception or promise rejection during startup or normal operation
- Startup failure that isn't a known recoverable condition (locked database, missing Documents path, etc.)
- Disk full — detected when the state persistence layer fails to write
- Any other state persistence write failure
- Renderer emits a console error but the window never appears within 15 seconds

**Renderer process**
- Unhandled exception or promise rejection (global handler)
- Redux state sanity check fails
- Attempt to mutate application state in a way that would duplicate or lose data
- Gamebryo plugin userlist file exists but cannot be read

**Exits without a dialog** (no chance to report)
- Very early startup failure before Electron is fully initialised — shows a native OS error box only
- User cancels during startup
- Window reference is lost at the moment Vortex tries to display it
- Renderer process crashes and the window reference is already gone

For file locations see [critical-errors.md § Known Crash Triggers](critical-errors.md#known-crash-triggers).

## Implementation

Error records are sent as OTel spans to a collector endpoint automatically when an error qualifies. See [telemetry-otel.md](telemetry-otel.md) for architecture details.
