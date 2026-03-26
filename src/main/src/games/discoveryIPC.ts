import { betterIpcMain } from "../ipc";
import { log } from "../logging";
import type { DiscoveryCoordinator } from "./DiscoveryCoordinator";
import type { RegistryScanner } from "./scanners/RegistryScanner";
import type QueryRegistry from "../store/QueryRegistry";

/**
 * Register IPC handlers for game discovery.
 */
export function setupDiscoveryIPC(
  coordinator: DiscoveryCoordinator,
  registryScanner: RegistryScanner,
  queryRegistry: QueryRegistry | undefined,
): void {
  betterIpcMain.handle("discovery:start", async () => {
    log("info", "discovery: triggered via IPC");
    await coordinator.runDiscovery();
  });

  betterIpcMain.handle("discovery:get-store-games", async () => {
    if (queryRegistry === undefined) {
      return [];
    }
    try {
      const results = await queryRegistry.executeQuery("all_store_games");
      return results as Array<{
        store_type: string;
        store_id: string;
        install_path: string;
        name: string | null;
        store_metadata: string | null;
      }>;
    } catch (err) {
      log("warn", "discovery: failed to get store games", {
        error: String(err),
      });
      return [];
    }
  });

  betterIpcMain.handle("discovery:registry-lookup", async (_event, query) => {
    return registryScanner.lookup(query);
  });

  log("info", "discovery: IPC handlers registered");
}
