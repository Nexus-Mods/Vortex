import { BrowserWindow } from "electron";

import type { DiffOperation } from "../../shared/types/ipc";
import type { PersistedHive } from "../../shared/types/state";

/**
 * Broadcast state patch operations to all renderer windows.
 *
 * Called by command handlers after writing to LevelDB.
 * The renderer applies these patches to Redux via __apply_patch,
 * which the persist middleware skips to avoid re-persisting.
 */
export function broadcastStatePatch(
  hive: PersistedHive,
  operations: DiffOperation[],
): void {
  if (operations.length === 0) {
    return;
  }

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && window.webContents !== undefined) {
      window.webContents.send("state:patch", hive, operations);
    }
  }
}
