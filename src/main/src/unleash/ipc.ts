import { TELEMETRY_ENABLED } from "@vortex/shared";
import { BrowserWindow } from "electron";

import { betterIpcMain } from "../ipc";
import { log } from "../logging";
import type { UnleashClient } from "./client";

export function synchronizeFeatureFlags(client: UnleashClient): () => void {
  // mkeiitmods: the flag server is Nexus Mods' Vortex instance, which receives the user id,
  // app version and usage metrics. Never contact it; every remote flag stays off.
  if (!TELEMETRY_ENABLED) {
    betterIpcMain.handle("flags:get-current", () => []);
    betterIpcMain.on("flags:setContext", () => undefined);
    betterIpcMain.on("flags:metrics", () => undefined);
    log("info", "remote feature flags are off");
    return () => undefined;
  }

  betterIpcMain.handle("flags:get-current", () => {
    return client.flags;
  });

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
