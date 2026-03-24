/**
 * Boots and wires the Stardew Valley extension feature modules.
 */
import { log, util } from "vortex-api";
import type { types } from "vortex-api";

// Core identifiers and shared state wiring.
import { GAME_ID } from "./common";
import sdvReducers from "./state/reducers";

// Feature modules registered during startup.
import { registerConfigMod } from "./configMod";
import StardewValleyGame from "./game/StardewValleyGame";
import { createManifestAttributeExtractor } from "./manifests/createManifestAttributeExtractor";
import ModManifestCache from "./manifests/ModManifestCache";
import { registerInstallers } from "./registration/registerInstallers";
import { registerModTypes } from "./registration/registerModTypes";
import { registerTests } from "./registration/registerTests";
import { registerUi } from "./registration/registerUi";
import { registerRuntimeEvents } from "./runtime/registerRuntimeEvents";
import {
  selectDiscoveredToolPath,
  selectSdvDiscoveryPath,
} from "./state/selectors";

/** Registers all Stardew Valley game, installer, runtime, and UI integrations. */
export default function init(context: types.IExtensionContext): void {
  // Tracks active mod manifests for dependency and compatibility checks.
  const modManifestCache = new ModManifestCache(context.api);

  // Reads the game's install folder from Vortex state.
  const getGameInstallPath = (): string => {
    const state = context.api.getState();
    const gameInstallPath = selectSdvDiscoveryPath(state);
    if (gameInstallPath === undefined) {
      log("error", "stardewvalley was not discovered");
      throw new Error("Stardew Valley was not discovered");
    }

    return gameInstallPath;
  };

  // Reads where Vortex discovered the SMAPI tool for this game.
  const getSMAPIPath = (game: types.IGame): string => {
    const state = context.api.getState();
    return selectDiscoveredToolPath(state, game.id);
  };

  // Register the game definition and SDV-specific reducer state.
  context.registerGame(new StardewValleyGame(context));
  context.registerReducer(["settings", "SDV"], sdvReducers);

  // Register user-facing UI (settings, actions, table columns).
  registerUi(context);
  // Register different mod installers (SMAPI, root folder, config mod) and their matching logic.
  registerInstallers(context, getGameInstallPath);
  registerModTypes(context, getGameInstallPath, getSMAPIPath);
  registerConfigMod(context);

  // Register metadata extraction from manifest.json during install.
  context.registerAttributeExtractor(
    25,
    createManifestAttributeExtractor(context),
  );

  // Register diagnostics and runtime event hooks.
  registerTests(context, modManifestCache);
  registerRuntimeEvents(context);
}
