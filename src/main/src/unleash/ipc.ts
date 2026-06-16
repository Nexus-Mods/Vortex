import { BrowserWindow } from "electron";

import { betterIpcMain } from "../ipc";
import { log } from "../logging";
import type { UnleashClient } from "./client";

export function synchronizeFeatureFlags(client: UnleashClient): () => void {
  betterIpcMain.on("flags:setContext", (_event, context) => {
    client.setContext(context);
  });

  betterIpcMain.on("flags:metrics", (_event, bucket) => {
    client.postMetrics(bucket).catch((err: unknown) => {
      log("warn", "unleash metrics post failed", { err });
    });
  });

  return client.start(undefined, (flags) => {
    for (const win of BrowserWindow.getAllWindows()) {
      betterIpcMain.send(win.webContents, "flags:synchronize", flags);
    }
  });
}
