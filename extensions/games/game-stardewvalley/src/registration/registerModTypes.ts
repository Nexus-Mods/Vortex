/**
 * Registers Stardew Valley mod type matchers and deployment roots.
 */
import path from "path";

import type { types } from "vortex-api";

import {
  GAME_ID,
  MOD_TYPE_CONFIG,
  MOD_TYPE_PRIORITY_CONFIG,
  MOD_TYPE_PRIORITY_ROOT,
  MOD_TYPE_PRIORITY_SMAPI,
  MOD_TYPE_ROOT,
  MODS_REL_PATH,
  MOD_TYPE_SMAPI,
} from "../common";
import { isSMAPIModType } from "../installers/smapi";
import { isSdvRootFolderModType } from "../modtypes/sdvRootFolderMatcher";

type ModTypeTest = Parameters<types.IExtensionContext["registerModType"]>[4];

/**
 * Registers Stardew Valley mod types.
 *
 * - `SMAPI`: normal SMAPI mods under the game mod directory
 * - `sdv-configuration-mod`: generated config aggregation mod
 * - `sdvrootfolder`: root-level installs, automatically classified when
 *   deployment targets `Content/`
 */
export function registerModTypes(
  context: types.IExtensionContext,
  getGameInstallPath: () => string,
  getSMAPIPath: (game: types.IGame) => string,
): void {
  const isSMAPIModTypeBoundary = isSMAPIModType as unknown as ModTypeTest;
  const isConfigModTypeBoundary = (() =>
    Promise.resolve(false)) as unknown as ModTypeTest;
  const isSdvRootFolderModTypeBoundary =
    isSdvRootFolderModType as unknown as ModTypeTest;

  context.registerModType(
    MOD_TYPE_SMAPI,
    MOD_TYPE_PRIORITY_SMAPI,
    (gameId) => gameId === GAME_ID,
    getSMAPIPath,
    isSMAPIModTypeBoundary,
  );

  context.registerModType(
    MOD_TYPE_CONFIG,
    MOD_TYPE_PRIORITY_CONFIG,
    (gameId) => gameId === GAME_ID,
    () => path.join(getGameInstallPath(), MODS_REL_PATH),
    isConfigModTypeBoundary,
  );

  context.registerModType(
    MOD_TYPE_ROOT,
    MOD_TYPE_PRIORITY_ROOT,
    (gameId) => gameId === GAME_ID,
    () => getGameInstallPath(),
    isSdvRootFolderModTypeBoundary,
  );
}
