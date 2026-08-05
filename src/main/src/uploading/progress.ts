import type { WireUploadProgress } from "@vortex/shared/ipc";
import type { WebContents } from "electron";

import { betterIpcMain } from "../ipc";
import type { ProgressHandler } from "./transport";

/**
 * got emits `uploadProgress` per socket write, which is thousands of events for
 * a large collection. Forward at most one per interval, plus any update that
 * jumps a meaningful number of bytes, so the renderer's progress bar moves
 * smoothly without the IPC traffic tracking the chunk size.
 */
const MIN_INTERVAL_MS = 250;
const MIN_BYTES = 1024 * 1024;

export function createProgressSender(
  webContents: WebContents,
  uploadId: number,
  total: number,
): ProgressHandler {
  let lastSentAt = 0;
  let lastSentBytes = -1;

  return (transferred: number) => {
    const now = Date.now();
    const enoughBytes = Math.abs(transferred - lastSentBytes) >= MIN_BYTES;
    const enoughTime = now - lastSentAt >= MIN_INTERVAL_MS;
    // Always let the final value through, so the bar lands on 100%.
    const isComplete = transferred >= total;
    if (!enoughBytes && !enoughTime && !isComplete) return;
    if (transferred === lastSentBytes) return;

    lastSentAt = now;
    lastSentBytes = transferred;

    if (webContents.isDestroyed()) return;
    const progress: WireUploadProgress = { uploadId, transferred, total };
    betterIpcMain.send(webContents, "upload:progress", progress);
  };
}
