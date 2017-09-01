import { ITool } from './ITool';

import * as Promise from 'bluebird';

/**
 * interface for game extensions
 *
 * @interface IGame
 */
export interface IGame extends ITool {
  /**
   * determine the directory where mods for this game
   * should be stored.
   *
   * If this returns a relative path then the path is treated as relative
   * to the game installation directory. Simply return a dot ( () => '.' )
   * if mods are installed directly into the game directory
   *
   * @memberOf IGame
   */
  queryModPath: () => string;

  /**
   * list of tools that support this game
   *
   * @memberOf IGame
   */
  supportedTools: ITool[];

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
   * Note: This flag is currently not used, vortex always acts as if mergeMods was true, the
   *   additional directory level is introduced by the mod installer
   *
   * @type {boolean}
   * @memberOf IGame
   */
  mergeMods: boolean;

  /**
   * determines if a file is to be merged with others with the same path, instead of the
   * highest-priority one being used. This only work if support for repackaging the file type
   * is available
   */
  mergeArchive?: (filePath: string) => boolean;

  /**
   * Optional setup function. If this game requires some form of setup before it can be modded
   * (like creating a directory, changing a registry key, ...) do it here. It will be called
   * every time before the game mode is activated.
   */
  setup?: () => Promise<void>;

  /**
   * additional details about the game that may be used by extensions. Some extensions may work
   * better/offer more features if certain details are provided but they are all optional.
   * Extensions should do their best to work without these details, even if it takes more work
   * (during development and potentially at runtime)
   */
  details?: { [key: string]: any };
}
