import type { CommandRegistry } from "../commands/CommandRegistry";
import type { DiscoveryCoordinator } from "./DiscoveryCoordinator";

import { log } from "../logging";

export function setupDiscoveryCommands(
  registry: CommandRegistry,
  coordinator: DiscoveryCoordinator,
): void {
  registry.register("discovery.start", async () => {
    log("info", "discovery: triggered via command");
    await coordinator.runDiscovery();
  });
}
