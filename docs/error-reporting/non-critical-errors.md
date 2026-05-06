# Non-Critical Error Handling

## Entry Point

`showError()` in `src/renderer/util/message.ts` — all user-visible error notifications go through here. Renderer process only.

## Reporting Decision

`shouldAllowReport()` returns `false` (suppressed) when any of these is true:

| Condition                        | Reason                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `options.allowReport === false`  | Explicit opt-out by caller                                                           |
| `options.warning === true`       | Warnings are not bugs                                                                |
| `err instanceof ThirdPartyError` | Extension errors aren't Vortex's to report                                           |
| `err instanceof UserCanceled`    | User-initiated, not a bug                                                            |
| `err.code` in `noReportErrors`   | Transient network error (`ETIMEDOUT`, `ECONNREFUSED`, `ECONNABORTED`, `ENETUNREACH`) |
| `isOutdated()`                   | Running version is behind latest release                                             |
| `didIgnoreError()`               | User clicked "Ignore" on a previous terminal error                                   |

Even when `shouldAllowReport()` returns `true`, the span is only exported if `isTelemetryEnabled()` is true in the main process (user has analytics on).

## OTel Recording

When allowed:

```
showError()
  └─ recordErrorSpan(title, error)              src/renderer/util/errorHandling.ts
       ├─ active span exists → applyErrorToSpan(activeSpan, ...)
       └─ no active span    → create root span "error.report", applyErrorToSpan, span.end()
            └─ applyErrorToSpan()
                 └─ recordErrorOnSpan(span, error, appVersion, globalContext)
                      ├─ span.setAttribute("error.fingerprint", ...)
                      ├─ span.recordException(error)
                      └─ span.setStatus({ code: ERROR })
```

ERROR status on the span triggers automatic export in `RingBufferSpanProcessor` — see [telemetry-otel.md](telemetry-otel.md).

## Ambient Context (Legacy)

`globalContext` in `src/renderer/util/errorHandling.ts` holds the current operational state (active game, mod being installed, etc.). Entries are attached to every span as `context.<key>` attributes.

```typescript
setErrorContext("gameId", "skyrimse");
```

## State Flags

| Flag           | Set by                                                        | Effect                                                   |
| -------------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| `outdated`     | `setOutdated(api)` — watches `persistent.nexus.newestVersion` | Suppresses reporting when Vortex is behind latest        |
| `errorIgnored` | `disableErrorReport()` or `did-ignore-error` IPC from main    | Suppresses reporting after user ignores a terminal error |

## `withTrackedActivity`

Higher-level operations use `withTrackedActivity()` instead of calling `showError()` directly. Wraps an async operation in an OTel span with automatic error recording.

- On success: span status set to `OK`
- On unhandled throw: status set to `ERROR`, exception recorded, re-thrown
- `{ root: true }` starts a new trace — use this for top-level user-initiated operations

**File**: `src/renderer/util/errorHandling.ts`

## Extension Error Links

When `options.extension` is set, the error dialog shows a **"Report"** button that opens the extension's issue tracker in the browser. No data is sent — it is a link only.

URL resolved from: `extension.info.issueTrackerURL` → Nexus Mods bug tab → GitHub issues.
