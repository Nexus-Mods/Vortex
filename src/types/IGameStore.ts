import { IExecInfo } from './IExecInfo';
import { IExtensionApi } from './IExtensionContext';
import { IGameStoreEntry } from './IGameStoreEntry';

import Bluebird from 'bluebird';

export type GameLaunchType = 'gamestore' | 'commandline';

export class GameStoreNotFound extends Error {
  private mName: string;
  constructor(name) {
    super('Missing game store extension');
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.mName = name;
  }

  public get storeName() {
    return this.mName;
  }
}

export class GameEntryNotFound extends Error {
  private mName: string;
  private mStore: string;
  private mExistingNames: string[];
  constructor(name: string, store: string, existing?: string[]) {
    super('Game entry not found');
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.mName = name;
    this.mStore = store;
    this.mExistingNames = existing;
  }

  // Returns the name of the game we couldn't find.
  public get gameName() {
    return this.mName;
  }

  // Name/Id of the store that couldn't find the game.
  public get storeName() {
    return this.mStore;
  }

  // Returns the name of the games we had confirmed exist
  //  in this game store.
  public get existingGames() {
    return this.mExistingNames;
  }
}

// Allows game extensions to pass arguments and attempt to partially
//  control how the game gets started. Please use the optional addInfo
//  parameter when returning from IGame::requiresLauncher
// requiresLauncher?: (gamePath: string) => Bluebird<{
//   launcher: string;
//   addInfo?: any; <- return a ICustomExecutionInfo object here.
// }>;
export interface ICustomExecutionInfo {
  appId: string;
  parameters: string[];
  launchType?: GameLaunchType;
}

/**
 * interface for game store launcher extensions
 *
 * @interface IGameStore
 */
export interface IGameStore {
  /**
   * This launcher's id.
   */
  id: string;

  /**
   * Returns all recognized/installed games which are currently
   *  installed with this game store/launcher. Please note that
   *  the game entries should be cached to avoid running a potentially
   *  resource intensive operation for each game the user attempts to
   *  manage.
   */
  allGames: () => Bluebird<IGameStoreEntry[]>;

  /**
   * Attempt to find a game entry using its game store Id/Ids.
   *
   * @param appId of the game entry. This is obviously game store specific.
   */
  findByAppId: (appId: string | string[]) => Bluebird<IGameStoreEntry>;

  /**
   * Attempt to find a game store entry using the game's name.
   *
   * @param appName the game name which the game store uses to identify this game.
   */
  findByName: (appName: string) => Bluebird<IGameStoreEntry>;

  /**
   * Returns the full path to the launcher's executable.
   *  As of 1.4, this function is no longer optional - gamestores
   *  such as the Xbox app which do not have a stat-able store path
   *  should return Bluebird.resolve(undefined) and define the
   *  "isGameStoreInstalled" function so that the game store helper
   *  is able to confirm that the gamestore is installed on the user's PC
   */
  getGameStorePath: () => Bluebird<string>;

  /**
   * Launches the game using this game launcher.
   * @param appId whatever the game store uses to identify a game.
   * @param api gives access to API functions if needed.
   */
  launchGame: (appId: any, api?: IExtensionApi) => Bluebird<void>;

  /**
   * Determine whether the game has been installed by this game store launcher.
   *  returns true if the game store installed this game, false otherwise.
   *
   * @param name of the game we're looking for.
   */
  isGameInstalled?: (name: string) => Bluebird<boolean>;

  /**
   * In most cases the game store helper is fully capable of determining
   *  whether a gamestore is installed by stat-ing the store's executable.
   *
   * However, gamestores such as the Xbox store which do not have a stat-able
   *  executable path MUST provide this function so that the game store helper
   *  can confirm that the store is installed correctly!
   */
  isGameStoreInstalled?: () => Bluebird<boolean>;

  /**
   * Some launchers may support Posix paths when attempting to launch a
   *  game, if set, the launcher will be expected to generate a valid
   *  posix path which Vortex can use to start the game.
   *
   * Please note that Vortex will not be able to tell if the game
   *  actually launched successfully when using Posix Paths; reason
   *  why this should only be used as a last resort.
   *
   * @param name of the game we want the posix path for.
   */
  getPosixPath?: (name: string) => Bluebird<string>;

  /**
   * Game store may support command line arguments when launching the game.
   *  Function will return the path to the game store's executable and any required
   *  arguments to launch the game.
   *
   * @param appId - Whatever the game store uses to identify a game.
   */
  getExecInfo?: (appId: any) => Bluebird<IExecInfo>;

  /**
   * Generally the game store helper should be able to launch games directly.
   *  This functor allows game stores to define their own custom start up logic
   *  if needed. e.g. gamestore-xbox
   */
  launchGameStore?: (api: IExtensionApi, parameters?: string[]) => Bluebird<void>;

  /**
   * Allows game stores to provide functionality to reload/refresh their
   *  game entries. This is potentially a resource intensive operation and
   *  should not be called unless it is vital to do so.
   *
   * The game store helper is configured to call this function for all known
   *  game stores when a discovery scan is initiated.
   */
  reloadGames?: () => Bluebird<void>;

  /**
   * determine if the specified game is managed by/installed through this store.
   * Stores don't have to implement this, as a fallback Vortex will go through
   * allGames from this store and see if one matches the path.
   * This function should only be implemented if there is a more reliable way to
   * connect this store to the game, like every gog game contains a gog.ico file
   * in the game root directory.
   * The fallback function can be used to invoke the "default" behavior on top.
   */
  identifyGame?: (gamePath: string,
                  fallback: (gamePath: string) => PromiseLike<boolean>) => Bluebird<boolean>;
}
