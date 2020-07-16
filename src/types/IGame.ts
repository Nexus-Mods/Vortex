import { IModType } from '../extensions/gamemode_management/types/IModType';
import { IStarterInfo } from '../util/StarterInfo';

import { IDiscoveryResult, IMod } from './IState';
import { ITool } from './ITool';

import Promise from 'bluebird';

export { IModType };

export type DirectoryCleaningMode = 'tag' | 'all';

/**
 * interface for game extensions
 *
 * @interface IGame
 */
export interface IGame extends ITool {
  /**
   * determine the default directory where mods for this game
   * should be stored.
   *
   * If this returns a relative path then the path is treated as relative
   * to the game installation directory. Simply return a dot ( () => '.' )
   * if mods are installed directly into the game directory
   *
   * @param gamePath path where the game is installed
   *
   * @memberOf IGame
   */
  queryModPath: (gamePath: string) => string;

  /**
   * returns all directories where mods for this game
   * may be stored as a dictionary of type to (absolute) path.
   *
   * Do not implement this in your game extension, the function
   * is added by vortex itself
   *
   * @param gamePath path where the game is installed
   *
   * @memberOf IGame
   */
  getModPaths?: (gamePath: string) => { [typeId: string]: string };

  /**
   * Determine whether the game needs to be executed via a launcher, like Steam or EpicGamesLauncher
   *
   * If this returns a value, Vortex will use appropriate code for that launcher
   *
   * @param gamePath path where the game is installed.
   */
  requiresLauncher?: (gamePath: string) => Promise<{ launcher: string, addInfo?: any }>;

  /**
   * returns the mod type extensions applicable to this game (all
   * mod types except the default
   *
   * Do not implement this in your game extension, this is added
   * by vortex
   *
   * @type {IModTypeExtension[]}
   * @memberof IGame
   */
  modTypes?: IModType[];

  /**
   * list of tools that support this game
   *
   * @memberOf IGame
   */
  supportedTools?: ITool[];

  /**
   * path to the game extension and assets included with it. This is automatically
   * set on loading the extension and and pre-set value is ignored
   *
   * @type {string}
   * @memberOf IGame
   */
  extensionPath?: string;

  /**
   * whether to merge mods in the destination directory or put each mod into a separate
   * dir.
   * Example: say queryModPath returns 'c:/awesomegame/mods' and you install a mod named
   *          'crazymod' that contains one file named 'crazytexture.dds'. If mergeMods is
   *          true then the file will be placed as c:/awesomegame/mods/crazytexture.dds.
   *          If mergeMods is false then it will be c:/awesomegame/mods/crazymod/crazytexture.dds.
   *
   * Note: For many games the mods are already packaged in such a way that the mod has an
   *       additional subdirectory. In games where this is the standard, mergeMods should be true,
   *       otherwise Vortex would be introducing one more directory level.
   * Note: This should be considered together with "stop folder" handling: If the installer has
   *       stop folders set up for a game it will attempt to eliminate "unnecessary" sub
   *       directories from the mod package.
   * TODO The name "mergeMods" is horrible since we also talk about "merging" in the context of
   *      combining individual files (archives) during mod deployment which is independent of this
   */
  mergeMods: boolean | ((mod: IMod) => string);

  /**
   * determines if a file is to be merged with others with the same path, instead of the
   * highest-priority one being used. This only works if support for repackaging the file type
   * is available
   */
  mergeArchive?: (filePath: string) => boolean;

  /**
   * Optional setup function. If this game requires some form of setup before it can be modded
   * (like creating a directory, changing a registry key, ...) do it here. It will be called
   * every time before the game mode is activated.
   */
  setup?: (discovery: IDiscoveryResult) => Promise<void>;

  /**
   * additional details about the game that may be used by extensions. Some extensions may work
   * better/offer more features if certain details are provided but they are all optional.
   * Extensions should do their best to work without these details, even if it takes more work
   * (during development and potentially at runtime)
   */
  details?: { [key: string]: any };

  /**
   * declares this game compatible or incompatible with a certain feature. If not specified, a
   * sensible default will be assumed for each game.
   * So for example if you know the game won't support symbolic links but Vortex offers it by
   * default, you can set "{ compatible: { symlinks: false } }" so Vortex won't offer the feature.
   * You will have to investigate or ask for the possible ids though. Since we will be introducing
   * new "gates" over time and so may extensions, it's not practical (at least at this time) to
   * maintain a list.
   */
  compatible?: { [key: string]: boolean };

  /**
   * set to name of the contributor that added support for this game. For officialy supported
   * games this is undefined
   */
  contributed?: string;

  /**
   * set to true if support for this game has been fully tested
   */
  final?: boolean;

  /**
   * contains the version of the game extension
   */
  version?: string;

  /**
   * if true, empty directories are cleaned up during deployment.
   * Right now this defaults to false if mergeMods is true, this defaults to true if mergeMods
   * is false or a function.
   * The reason being that otherwise we would be leaving empty directories every time a mod gets
   * disabled or the deployment name changes.
   * Users can also manually force the cleanup for all games.
   */
  requiresCleanup?: boolean;

  /**
   * decides how Vortex decides which empty directories to clean.
   * With 'tag' (default) we put a dummy file into each directory created by Vortex and only
   *   those get removed during purge (or after deployment if requiresCleanup is enabled)
   * With 'all' Vortex will simply clean up all empty directories, whether Vortex created them
   *   or not. In some (unusual) cases this may break mods
   */
  directoryCleaning?: DirectoryCleaningMode;

  /**
   * if set this function is always called before automatic deployment and it will be delayed
   * until the promise resolves.
   * This can be used if the deployment process is very slow and/or involves user interaction
   * (e.g. through will-deploy/did-deploy event handlers) to prevent managament becoming impractical
   * due to automated deployment constantly requiring attention.
   *
   * Once the promise resolves the mods as enabled at that time will be deployed, so for example
   * if the user enabled a mod while this promise is pending, that mod will be deployed.
   */
  deploymentGate?: () => Promise<void>;
}
