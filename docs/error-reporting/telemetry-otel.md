# OpenTelemetry Architecture

Only traces containing at least one ERROR-status span are exported. Non-error traces stay in the ring buffer until overwritten.

## Process Model

| `process.type` | Processor                 | Export strategy                         |
| -------------- | ------------------------- | --------------------------------------- |
| `main`         | `RingBufferSpanProcessor` | Deferred; triggered on ERROR status     |
| `renderer`     | `ForwardingSpanProcessor` | Immediate IPC forward to main           |
| `report`       | `SimpleSpanProcessor`     | Synchronous; `forceFlush()` on shutdown |

## Main Process

**Setup**: `createMainTelemetryProvider()` in `src/main/telemetry/setup.ts` — called once at startup.

### RingBufferSpanProcessor

**File**: `src/main/telemetry/RingBufferSpanProcessor.ts`

- Maintains a circular buffer of up to 500 finished spans (configurable via `maxSpans`)
- `onStart` — span added to the in-flight map
- `onEnd`:
    1. Span removed from in-flight map
    2. If `traceId` already exported → export span immediately (late arrival)
    3. Otherwise → add span to ring buffer
    4. If `span.status.code === ERROR` → extract all buffered spans for this `traceId`, invoke `onExportSpans`

`exportedTraceIds` is capped at 1000 entries (FIFO eviction) to prevent the set from growing unbounded.

### OTLP Export

```typescript
onExportSpans: (spans) => {
    if (!isTelemetryEnabled()) return;
    exporter.export(spans, () => {});
};
```

- Default endpoint: `https://vortex-collector.nexusmods.com/v1/traces`
- Override: `VORTEX_COLLECTOR_URL` environment variable

## Renderer Process

**Setup**: `src/renderer/extensions/telemetry/index.ts`

`ForwardingSpanProcessor` sends every completed span to main via IPC:

```
Renderer                        Preload                   Main
window.api.telemetry            betterIpcRenderer.send(   betterIpcMain.on(
  .forwardSpan(serializedSpan)    "telemetry:forward-span"  "telemetry:forward-span",
                                  span)                      (_e, span) =>
                                                             getProcessor()?.onEnd(
                                                               deserializeSpan(span)))
```

Spans are serialized to plain JSON (`SerializedSpan`) for IPC transfer.

**Files**:

- Renderer: `src/renderer/extensions/telemetry/index.ts`
- Preload bridge: `src/preload/index.ts`
- Main receiver: `src/main/telemetry/ipcHandler.ts`

### Bluebird Context Propagation

`patchBluebirdContext()` in `src/renderer/extensions/telemetry/bluebird-patch.ts` installs a hook so OTel context propagates correctly through Bluebird promise chains.

## Crash Reporter Subprocess

**Setup**: `reportCrash()` in `src/main/errorReporting.ts`

Short-lived provider created per crash:

1. `createErrorReport()` writes `crashinfo.json`
2. `spawnSelf(["--report", path])` starts new Electron process
3. Subprocess: `sendReportFile()` → `reportCrash()`
4. `reportCrash()` creates `BasicTracerProvider` with `SimpleSpanProcessor`
5. Records and ends a `crash.report` span
6. `provider.forceFlush()` guarantees delivery before `provider.shutdown()`

## Analytics Opt-In

`settings.analytics.enabled` in Redux state controls whether spans are exported.

Main process watches for changes via `persist:diff` IPC in `src/main/telemetry/ipcHandler.ts`. Initial value read from LevelDB at startup in `src/main/Application.ts`.

> [!note]
> `setTelemetryEnabled` and `isTelemetryEnabled` live in `src/main/telemetry/state.ts`. All callers must use static TypeScript imports (compiled to `require()`), not `await import()`, to share the same CJS module singleton.

## Error Fingerprinting

**File**: `src/shared/src/errors.ts` — `computeErrorFingerprint(stack, appVersion)`

1. Split stack into `"at ..."` frames
2. Sanitize each frame — strips machine-specific paths, preserves `src/`, `node_modules/`, `app.asar`, `plugins/`
3. Hash: `fnv1a(sanitizedFrames + "\n" + appVersion)` → 8-character hex string

Stable across machines; version-scoped so different releases produce different fingerprints.

## Privacy Sanitisation (allow-list)

**File**: `src/shared/src/telemetry/sanitizer.ts`

Error traces can be exported **without analytics consent** (LAZ-638), with
consent selecting the **sanitisation mode** per export rather than gating it.

Unconsented export is behind a switch — `isUnconsentedReportingEnabled()` in
`telemetry/state.ts`, **disabled, used for development only**.

`SanitizingSpanExporter` wraps the OTLP exporter and is the single enforcement
boundary — both the main-process ring buffer (`telemetry/setup.ts`) and the
crash reporter (`errorReporting.ts`) export through it, so main spans,
renderer-forwarded spans and crash reports are all covered regardless of how
their attributes were set upstream. It is constructed with an `isConsented`
predicate (wired to `isTelemetryEnabled`); omitting it defaults to **strict**.

### Strict mode (no consent) — deny-by-default

Only allow-listed attributes survive; everything else is dropped. Attributes
added anywhere in the codebase are excluded until consciously added to the
allow-list. Per span it:

- **Drops** any span attribute not in the allow-list — including local names and
  paths such as `context.value`, `mod.baseName`, `mod.modId`, `mod.archiveId`,
  `mod.installerChoices`, `extension.archive`, `deployment.modPath`, and the
  `*.transfer.from`/`to` path attributes.
- **Buckets** counts (`context.mod_count`, `context.active_downloads`,
  `deployment.modCount`, `mod.fileCount`) into ranges (`0-50`, `51-100`, …) so an
  exact count can't fingerprint a user.
- **Reduces** span events to `exception` only, keeping just the standard OTel
  exception fields (`exception.type`/`message`/`stacktrace`/`escaped`).

Only **public** Nexus identifiers pass from the mod-install span
(`mod.numericModId`, `mod.fileId`); the internal `mod.modId` (derived from the
local archive name) is dropped.

The allow-list was cross-checked against ~2 months of collected traces
(ClickStack `vortex.otel_traces`): every attribute key the app actually emits is
either allowed (e.g. `error.isCommunityExtension`, `componentStack`) or
deliberately dropped (`download.fileName`, `download.url`, `context.value`,
`*.transfer.*`, `mod.baseName`/`installerChoices`/`archiveId`, `extension.archive`).

### Baseline mode (consent given) — richer payload

All span attributes and events are kept and exact counts are included. This is
where the consented payload can carry local mod names and (per APP-425) a user
id for cross-session correlation.

### Always-on (both modes)

- String values run through `sanitizeFramePath` (strips install prefixes, redacts
  the OS username — including multi-word Windows account names) then well-known
  folders are tokenised (`C:\Program Files` → `programfiles:/`). Username/path
  redaction is baseline GDPR minimisation and is never gated on consent.
- The **resource** is always reduced to its allow-list (process metadata only —
  `service.*`, `process.*`, `os.*`, `host.arch`, `deployment.environment`); never
  hostnames or usernames.

The crash reporter receives consent explicitly: `createErrorReport` (renderer)
captures it into `crashinfo.json` while the state is available, and the report
subprocess reads it back. In-process main callers forward `isTelemetryEnabled()`.
When consent is unknown (early crash before state exists, or a malformed report
file) it defaults to `false` → strict, the safe floor for the most sensitive
payload.

## Attributes Reference

### Resource (every span)

| Attribute                | Value                                 |
| ------------------------ | ------------------------------------- |
| `service.name`           | `"vortex"`                            |
| `service.version`        | `app.getVersion()`                    |
| `process.type`           | `"main"`, `"renderer"`, or `"report"` |
| `process.pid`            | Runtime PID                           |
| `os.type` / `os.version` | OS info                               |
| `host.arch`              | CPU architecture                      |

### Error span

| Attribute                                                       | Value                                        |
| --------------------------------------------------------------- | -------------------------------------------- |
| `error.fingerprint`                                             | FNV-1a hash                                  |
| `error.title`                                                   | Human-readable title if provided             |
| `exception.type` / `exception.message` / `exception.stacktrace` | Standard OTel exception fields               |
| `context.<key>`                                                 | Ambient context entries from `globalContext` |
