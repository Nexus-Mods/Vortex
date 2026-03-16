/* eslint-disable */
import { log, types, util } from 'vortex-api';

// Core identifiers and shared state wiring.
import { GAME_ID } from './common';
import sdvReducers from './reducers';

// Feature modules registered during startup.
import { registerConfigMod } from './configMod';
import DependencyManager from './DependencyManager';
import StardewValleyGame from './game/StardewValleyGame';
import { createManifestAttributeExtractor } from './manifests/createManifestAttributeExtractor';
import { registerInstallers } from './registration/registerInstallers';
import { registerModTypes } from './registration/registerModTypes';
import { registerTests } from './registration/registerTests';
import { registerUi } from './registration/registerUi';
import { registerRuntimeEvents } from './runtime/registerRuntimeEvents';

/**
 * Stardew Valley extension bootstrap.
 *
 * This file intentionally stays small and acts as a composition root that wires
 * together focused modules.
 *
 * See `README.md` in this folder for a high-level module map aimed at
 * contributors unfamiliar with Vortex internals.
 */
function init(context: types.IExtensionContext) {
  // Tracks active mod manifests for dependency and compatibility checks.
  const dependencyManager = new DependencyManager(context.api);

  // Reads the discovered game install folder from Vortex state.
  const getDiscoveryPath = (): string => {
    const state = context.api.getState();
    const discoveryPath = util.getSafe(state, ['settings', 'gameMode', 'discovered', GAME_ID, 'path'], undefined);
    if (discoveryPath === undefined) {
      log('error', 'stardewvalley was not discovered');
      throw new Error('Stardew Valley was not discovered');
    }

    return discoveryPath;
  };

  // Reads where Vortex discovered the SMAPI tool for this game.
  const getSMAPIPath = (game: types.IGame) => {
    const state = context.api.getState();
    return util.getSafe(state, ['settings', 'gameMode', 'discovered', game.id, 'path'], '');
  };

  // Register the game definition and SDV-specific reducer state.
  context.registerGame(new StardewValleyGame(context));
  context.registerReducer(['settings', 'SDV'], sdvReducers);

  // Register user-facing UI (settings, actions, table columns).
  registerUi(context);
  // Register archive matchers/installers used during mod installation.
  registerInstallers(context, getDiscoveryPath, dependencyManager);
  // Register SDV mod type matchers and deployment roots.
  registerModTypes(context, getDiscoveryPath, getSMAPIPath);
  // Register config-file sync action/flows.
  registerConfigMod(context);

  // Register metadata extraction from manifest.json during install.
  context.registerAttributeExtractor(25, createManifestAttributeExtractor(context));

  // Register diagnostics and runtime event hooks.
  registerTests(context, dependencyManager);
  registerRuntimeEvents(context, dependencyManager);
}

export default init;
