import { BrowserWindow } from "electron";

import { betterIpcMain } from "../ipc";
import type { UnleashClient } from "./client";

export function synchronizeFeatureFlags(client: UnleashClient): () => void {
  return client.start(undefined, (flags) => {
    for (const win of BrowserWindow.getAllWindows()) {
      betterIpcMain.send(win.webContents, "flags:synchronize", flags);
    }
  });
}
