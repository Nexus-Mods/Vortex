/**
 * Compatibility stubs for legacy game store API.
 *
 * Extensions using `util.steam`, `util.epicGamesLauncher`, or `util.GameNotFound`
 * will continue to work via these shims, which delegate to `util.GameStoreHelper`.
 *
 * @deprecated Use `util.GameStoreHelper` directly instead.
 */

import type { IGameStoreEntry } from "../types/IGameStoreEntry";
import GameStoreHelper from "./GameStoreHelper";
import steamInstance, { GameNotFound } from "./Steam";

/**
 * @deprecated Use `util.GameStoreHelper.findByName(name, 'steam')` or
 *   `util.GameStoreHelper.findByAppId(appId, 'steam')` instead.
 */
const steam = {
  findByName(namePattern: string): PromiseLike<IGameStoreEntry> {
    return GameStoreHelper.findByName(namePattern, "steam");
  },
  findByAppId(appId: string | string[]): PromiseLike<IGameStoreEntry> {
    return GameStoreHelper.findByAppId(appId, "steam");
  },
  allGames(): PromiseLike<IGameStoreEntry[]> {
    return steamInstance.allGames();
  },
};

/**
 * @deprecated Use `util.GameStoreHelper.findByName(name, 'epic')`,
 *   `util.GameStoreHelper.findByAppId(appId, 'epic')`, or
 *   `util.GameStoreHelper.isGameInstalled(id, 'epic')` instead.
 */
const epicGamesLauncher = {
  findByAppId(appId: string | string[]): PromiseLike<IGameStoreEntry> {
    return GameStoreHelper.findByAppId(appId, "epic");
  },
  findByName(name: string): PromiseLike<IGameStoreEntry> {
    return GameStoreHelper.findByName(name, "epic");
  },
  isGameInstalled(name: string): PromiseLike<boolean> {
    return GameStoreHelper.isGameInstalled(name, "epic").then(
      (storeId) => storeId !== undefined,
    );
  },
};

export { epicGamesLauncher, GameNotFound, steam };
