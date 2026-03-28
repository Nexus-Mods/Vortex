import { BrowserWindow } from "electron";

import { betterIpcMain } from "../ipc";
import { log } from "../logging";
import type QueryInvalidator from "./QueryInvalidator";
import type QueryRegistry from "./QueryRegistry";

/**
 * Set up generic IPC handlers for the query system.
 *
 * - `query:execute`: renderer can execute any named query
 * - `query:dirty`: main broadcasts dirty query names to all windows
 */
export function setupQueryIPC(
  queryRegistry: QueryRegistry,
  queryInvalidator: QueryInvalidator,
): void {
  betterIpcMain.handle("query:execute", async (_event, queryName, params) => {
    return queryRegistry.executeQuery(queryName, params);
  });

  queryInvalidator.setBroadcast((queryNames) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        betterIpcMain.send(win.webContents, "query:dirty", queryNames);
      }
    }
  });

  log("info", "query IPC handlers registered");
}
