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
  pluginPath?: string;

  /**
   * whether to merge mods in the destination directory or put each mod into a separate
   * dir.
   * Example: say queryModPath returns 'c:/awesomegame/mods' and you install a mod named
   *          'crazymod' that contains one file named 'crazytexture.dds'. If mergeMods is
   *          true then the file will be placed as c:/awesomegame/mods/crazytexture.dds.
   *          If mergeMods is false then it will be c:/awesomegame/mods/crazymod/crazytexture.dds.
   *
   * @type {boolean}
   * @memberOf IGame
   */
  mergeMods: boolean;

  /**
   * Optional setup function. If this game requires some form of setup before it can be modded
   * (like creating a directory, changing a registry key, ...) do it here. It will be called
   * every time before the game mode is activated.
   */
  setup?: () => Promise<void>;
}
