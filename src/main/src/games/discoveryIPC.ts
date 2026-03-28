import { betterIpcMain } from "../ipc";
import { log } from "../logging";
import type { DiscoveryCoordinator } from "./DiscoveryCoordinator";
import type { RegistryScanner } from "./scanners/RegistryScanner";

/**
 * Register IPC handlers for game discovery.
 *
 * Note: `discovery:get-store-games` was removed — use the generic
 * `query:execute("all_store_games", {})` instead.
 */
export function setupDiscoveryIPC(
  coordinator: DiscoveryCoordinator,
  registryScanner: RegistryScanner,
): void {
  betterIpcMain.handle("discovery:start", async () => {
    log("info", "discovery: triggered via IPC");
    await coordinator.runDiscovery();
  });

  betterIpcMain.handle("discovery:registry-lookup", async (_event, query) => {
    return registryScanner.lookup(query);
  });

  log("info", "discovery: IPC handlers registered");
}
