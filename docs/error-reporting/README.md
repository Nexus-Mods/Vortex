# Error Reporting

## Documents

- [OVERVIEW.md](OVERVIEW.md) - Non-technical summary of how error reporting works
- [non-critical-errors.md](non-critical-errors.md) - Recoverable errors: filtering logic, OTel recording
- [critical-errors.md](critical-errors.md) - Fatal errors: terminate paths, crash reporter subprocess
- [telemetry-otel.md](telemetry-otel.md) - OTel architecture: ring buffer, IPC forwarding, export

## Key Files

- `src/renderer/util/message.ts` - `showError()` entry point for non-critical errors
- `src/renderer/util/errorHandling.ts` - `withTrackedActivity`, `recordErrorSpan`, `terminate` (renderer)
- `src/main/errorHandling.ts` - `terminate` / `terminateAsync` for main-process crashes
- `src/main/errorReporting.ts` - `reportCrash()` — short-lived OTel provider for crash spans
- `src/main/telemetry/RingBufferSpanProcessor.ts` - Circular buffer; auto-exports on ERROR status
- `src/main/telemetry/setup.ts` - `createMainTelemetryProvider`, OTLP exporter config
- `src/main/telemetry/ipcHandler.ts` - Renderer→main span IPC bridge; analytics opt-in watcher
- `src/shared/src/telemetry/spans.ts` - `recordErrorOnSpan` shared utility
- `src/shared/src/errors.ts` - `computeErrorFingerprint` for deduplication

## Flow

```
error occurs
  └─ recordErrorOnSpan()        sets ERROR status + fingerprint on span
       └─ span.end()
            └─ RingBufferSpanProcessor.onEnd()
                 └─ status == ERROR?
                      yes ──> extract all spans for this traceId
                               isTelemetryEnabled()?
                                 yes ──> OTLPTraceExporter → vortex-collector.nexusmods.com
```

Renderer spans are forwarded to main via IPC (`telemetry:forward-span`) before entering the ring buffer.
