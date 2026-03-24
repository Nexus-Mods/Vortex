/**
 * Main-process game adaptor system.
 *
 * Games can be registered two ways:
 *
 * 1. YAML data files — place *.yaml files in the configured directory and they
 *    are loaded automatically via registerYamlAdaptors().
 *
 * 2. Code-based — implement IGameAdaptor (and optionally IInstallerAdaptor),
 *    then register the instance below using `registry.registerGame(...)`.
 *
 * Example (code-based):
 *
 *   import { StardewValley } from "./stardewvalley";
 *   registry.registerGame(new StardewValley());
 */

import * as path from "node:path";

import { GameAdaptorRegistry } from "./GameAdaptorRegistry";
import { registerYamlAdaptors } from "./yaml";

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
export { registerYamlAdaptors } from "./yaml";

const registry = GameAdaptorRegistry.getInstance();

// ─── YAML-based game adaptors ─────────────────────────────────────────────────
// Default: look for *.yaml files next to the built output (src/main/out/game-adaptors/)
const yamlDir = path.resolve(__dirname, "..", "game-adaptors");
registerYamlAdaptors(registry, yamlDir);

// ─── Code-based game adaptors ─────────────────────────────────────────────────
// registry.registerGame(new StardewValley());
// registry.registerInstaller(new StardewValleyInstaller());
