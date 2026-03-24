/**
 * Main-process game adaptor system.
 *
 * To add support for a new game, implement IGameAdaptor (and optionally IInstallerAdaptor),
 * then register the instance below using `registry.registerGame(...)`.
 *
 * Example:
 *
 *   import { StardewValley } from "./stardewvalley";
 *   registry.registerGame(new StardewValley());
 */

import { GameAdaptorRegistry } from "./GameAdaptorRegistry";

export { GameAdaptorRegistry };
export { initGameAdaptorIPC } from "./gameAdaptorIPC";
export type {
  IGameAdaptor,
  IInstallerAdaptor,
  ISerializedDiscovery,
  ISerializedGameMeta,
  ISerializedInstallResult,
  ISerializedInstallerMeta,
  ISupportedResult,
} from "./IGameAdaptor";

const registry = GameAdaptorRegistry.getInstance();

// ─── Register game adaptors here ─────────────────────────────────────────────
// registry.registerGame(new StardewValley());

// ─── Register installer adaptors here ────────────────────────────────────────
// registry.registerInstaller(new StardewValleyInstaller());

void registry; // suppress unused-variable lint until first registration is added
