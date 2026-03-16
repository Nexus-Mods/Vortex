/**
 * Registers Stardew Valley mod type matchers and deployment roots.
 */
import Bluebird from 'bluebird';
import path from 'path';

import type { types } from 'vortex-api';

import {
  GAME_ID,
  MOD_TYPE_CONFIG,
  MOD_TYPE_PRIORITY_CONFIG,
  MOD_TYPE_PRIORITY_ROOT,
  MOD_TYPE_PRIORITY_SMAPI,
  MOD_TYPE_ROOT,
  MODS_REL_PATH,
  MOD_TYPE_SMAPI,
} from '../common';
import { isSMAPIModType } from '../installers/smapi';
import { isSdvRootFolderModType } from '../modtypes/sdvRootFolderMatcher';

/**
 * Registers Stardew Valley mod types.
 *
 * - `SMAPI`: normal SMAPI mods under the game mod directory
 * - `sdv-configuration-mod`: generated config aggregation mod
 * - `sdvrootfolder`: root-level installs, automatically classified when
 *   deployment targets `Content/`
 */
export function registerModTypes(context: types.IExtensionContext,
                                   getGameInstallPath: () => string,
                                   getSMAPIPath: (game: types.IGame) => string): void {
  context.registerModType(MOD_TYPE_SMAPI, MOD_TYPE_PRIORITY_SMAPI,
    gameId => gameId === GAME_ID, getSMAPIPath, isSMAPIModType);

  context.registerModType(MOD_TYPE_CONFIG, MOD_TYPE_PRIORITY_CONFIG, gameId => gameId === GAME_ID,
    () => path.join(getGameInstallPath(), MODS_REL_PATH), () => Bluebird.resolve(false));

  context.registerModType(MOD_TYPE_ROOT, MOD_TYPE_PRIORITY_ROOT, gameId => gameId === GAME_ID,
    () => getGameInstallPath(), isSdvRootFolderModType);
}
