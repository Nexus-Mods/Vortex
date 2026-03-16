/* eslint-disable */
import Bluebird from 'bluebird';
import path from 'path';

import type { types } from 'vortex-api';

import { GAME_ID, MOD_TYPE_CONFIG } from '../common';
import { isSMAPIModType } from '../installers/smapiInstaller';
import { isSdvRootFolderModType } from '../modtypes/sdvRootFolderMatcher';
import { defaultModsRelPath } from '../util';

/**
 * Registers Stardew Valley mod types.
 *
 * - `SMAPI`: normal SMAPI mods under the game mod directory
 * - `sdv-configuration-mod`: generated config aggregation mod
 * - `sdvrootfolder`: root-level installs, automatically classified when
 *   deployment targets `Content/`
 */
export function registerModTypes(context: types.IExtensionContext,
                                 getDiscoveryPath: () => string,
                                 getSMAPIPath: (game: any) => string) {
  context.registerModType('SMAPI', 30, gameId => gameId === GAME_ID, getSMAPIPath, isSMAPIModType);

  context.registerModType(MOD_TYPE_CONFIG, 30, gameId => gameId === GAME_ID,
    () => path.join(getDiscoveryPath(), defaultModsRelPath()), () => Bluebird.resolve(false));

  context.registerModType('sdvrootfolder', 25, gameId => gameId === GAME_ID,
    () => getDiscoveryPath(), isSdvRootFolderModType);
}
