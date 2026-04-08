import type QueryInvalidator from "../store/QueryInvalidator";

import { getMainCommands } from "../commands/mainCommands";
import { log } from "../logging";
import DuckDBSingleton from "../store/DuckDBSingleton";
import { setupDiscoveryCommands } from "./discoveryCommands";
import { DiscoveryCoordinator } from "./DiscoveryCoordinator";
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
 * handlers, and runs an initial discovery. Store game data is exposed
 * to the renderer via the generic query IPC system (query:execute / query:dirty).
 */
export async function initDiscovery(
  queryInvalidator: QueryInvalidator | undefined,
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

  // Set up command handlers
  setupDiscoveryCommands(getMainCommands(), coordinator);

  // Run initial discovery (non-blocking)
  coordinator.runDiscovery().catch((err) => {
    log("warn", "discovery: initial scan failed", {
      error: err instanceof Error ? err.message : "Unknown discovery error",
    });
  });

  log("info", "discovery: system initialized");
}
