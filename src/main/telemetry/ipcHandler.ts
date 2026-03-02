import {
  getProcessor,
  setTelemetryEnabled,
  deserializeSpan,
} from "@vortex/shared/telemetry";
import { betterIpcMain } from "../ipc";

/**
 * Register IPC handlers for telemetry:
 * 1. Receives serialized spans from the renderer and feeds them into main's
 *    existing RingBufferSpanProcessor.
 * 2. Watches persist:diff for analytics opt-in changes to gate export.
 *
 * Call once after {@link createMainTelemetryProvider}.
 */
export function initTelemetryIpcHandler(): void {
  betterIpcMain.on("telemetry:forward-span", (_event, serializedSpan) => {
    const span = deserializeSpan(serializedSpan);
    getProcessor()?.onEnd(span);
  });

  // Watch for analytics opt-in state changes via persistence diffs.
  // The settings hive includes ["analytics", "enabled"].
  betterIpcMain.on("persist:diff", (_event, hive, operations) => {
    if (hive !== "settings") return;
    for (const op of operations) {
      if (
        op.path.length === 2 &&
        op.path[0] === "analytics" &&
        op.path[1] === "enabled"
      ) {
        setTelemetryEnabled(op.type === "set" && op.value === true);
        break;
      }
    }
  });
}
