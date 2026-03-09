/**
 * IPC handlers for persistence operations.
 *
 * This module sets up the IPC communication between the renderer process
 * (which owns the Redux store) and the main process (which handles persistence).
 *
 * Flow:
 * 1. On startup, renderer calls `persist:get-hydration` to get initial state
 * 2. On state changes, renderer sends `persist:diff` with diff operations
 * 3. Main process applies operations to LevelDB via ReduxPersistorIPC
 */

import type { PersistedHive, PersistedState } from "@vortex/shared/state";
import type { WebContents } from "electron";

import type ReduxPersistorIPC from "./ReduxPersistorIPC";

import { betterIpcMain } from "../ipc";
import { log } from "../logging";
import { registerAllPersistedHives } from "./mainPersistence";

/**
 * Set up IPC handlers for persistence operations.
 *
 * @param persistor - The ReduxPersistorIPC instance to use for persistence
 */
export function setupPersistenceIPC(persistor: ReduxPersistorIPC): void {
  // Handle incoming diff operations from renderer
  betterIpcMain.on("persist:diff", (_event, hive, operations) => {
    log("debug", "Received persist:diff", {
      hive,
      operationCount: operations.length,
    });
    persistor.applyDiffOperations(hive, operations);
  });

  // Handle hydration request from renderer at startup
  // Auto-discovers all hives in the database and registers them
  betterIpcMain.handle("persist:get-hydration", async (_event) => {
    log("debug", "Renderer requested hydration data");
    // Auto-discover and register all hives found in the database
    const data = await registerAllPersistedHives();
    log("debug", "Sending hydration data", {
      hives: Object.keys(data),
    });
    return data;
  });
}

/**
 * Send hydration data for a specific hive to the renderer.
 * Used for incremental hydration after initial load.
 *
 * @param webContents - The WebContents to send to
 * @param hive - The hive name
 * @param data - The hydration data for the specified hive
 */
export function sendHydrationToRenderer<H extends PersistedHive>(
  webContents: WebContents,
  hive: H,
  data: PersistedState[H],
): void {
  betterIpcMain.send(webContents, "persist:hydrate", hive, data);
}
