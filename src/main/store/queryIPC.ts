import type { Serializable } from "../../shared/types/ipc";
import { betterIpcMain } from "../ipc";
import { log } from "../logging";
import type QueryRegistry from "./QueryRegistry";

/**
 * Register IPC handlers for the query system.
 * Delegates query:execute and query:list to the QueryRegistry.
 */
export function setupQueryIPC(registry: QueryRegistry): void {
  betterIpcMain.handle("query:execute", async (_event, queryName, params) => {
    try {
      const results = await registry.executeQuery(
        queryName,
        params as Record<string, unknown> | undefined,
      );
      return results as Serializable[];
    } catch (err) {
      log("error", "query:execute failed", {
        queryName,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  });

  betterIpcMain.handle("query:list", async () => {
    return registry.getQueryNames();
  });

  log("debug", "query-ipc: handlers registered");
}
