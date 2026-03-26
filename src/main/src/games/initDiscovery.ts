import { BrowserWindow } from "electron";

import { log } from "../logging";
import { betterIpcMain } from "../ipc";
import DuckDBSingleton from "../store/DuckDBSingleton";
import type QueryInvalidator from "../store/QueryInvalidator";
import type QueryRegistry from "../store/QueryRegistry";
import type QueryWatcher from "../store/QueryWatcher";

import { DiscoveryCoordinator } from "./DiscoveryCoordinator";
import { setupDiscoveryIPC } from "./discoveryIPC";
import { EpicScanner } from "./scanners/EpicScanner";
import { GOGScanner } from "./scanners/GOGScanner";
import { OriginScanner } from "./scanners/OriginScanner";
import { RegistryScanner } from "./scanners/RegistryScanner";
import { SteamScanner } from "./scanners/SteamScanner";
import { UplayScanner } from "./scanners/UplayScanner";
import { XboxScanner } from "./scanners/XboxScanner";

/**
 * Initialize the game discovery system.
 *
 * Creates all store scanners, the DiscoveryCoordinator, wires up IPC
 * handlers, sets up a DuckDB query watcher to push store_games data
 * to the renderer, and runs an initial discovery.
 */
export async function initDiscovery(
  queryRegistry: QueryRegistry | undefined,
  queryInvalidator: QueryInvalidator | undefined,
  queryWatcher: QueryWatcher | undefined,
): Promise<void> {
  if (queryInvalidator === undefined) {
    log("warn", "discovery: query invalidator not available, skipping init");
    return;
  }

  const singleton = DuckDBSingleton.getInstance();
  if (!singleton.isInitialized) {
    log("warn", "discovery: DuckDB not initialized, skipping init");
    return;
  }

  // Create a dedicated connection for the coordinator to write store_games
  const connection = await singleton.createConnection();

  // Create scanners
  const registryScanner = new RegistryScanner();
  const scanners = [
    new SteamScanner(),
    new GOGScanner(),
    new EpicScanner(),
    new XboxScanner(),
    new OriginScanner(),
    new UplayScanner(),
    registryScanner,
  ];

  // Create coordinator
  const coordinator = new DiscoveryCoordinator(
    scanners,
    connection,
    queryInvalidator,
  );

  // Set up IPC handlers
  setupDiscoveryIPC(coordinator, registryScanner, queryRegistry);

  // Set up query watcher to push store_games to renderer
  if (queryWatcher !== undefined) {
    queryWatcher.watch("all_store_games", {}, (diff) => {
      // Push the full current result set to all renderer windows
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          betterIpcMain.send(
            win.webContents,
            "discovery:store-games-updated",
            diff.current as Array<{
              store_type: string;
              store_id: string;
              install_path: string;
              name: string | null;
              store_metadata: string | null;
            }>,
          );
        }
      }
    });
    log("info", "discovery: query watcher set up for store_games");
  }

  // Run initial discovery (non-blocking)
  coordinator.runDiscovery().catch((err) => {
    log("warn", "discovery: initial scan failed", { error: String(err) });
  });

  log("info", "discovery: system initialized");
}
