import * as Promise from 'bluebird';

/**
 * interface for game extensions
 * 
 * @interface IGame
 */
export interface IGame {
  /**
   * determine installation path of this game
   * This function should return quickly and, if it returns a value
   * it should definitively be the valid game path. Usually this function
   * will query the path from the registry or from steam.
   * This function may return a promise and should if it's doing I/O
   * 
   * @memberOf IGame
   */
  queryGamePath: () => string | Promise<string>;

  /**
   * internal name of the game
   * 
   * @type {string}
   * @memberOf IGame
   */
  id: string;

  /**
   * human readable game name used in presentation to the user
   * 
   * @type {string}
   * @memberOf IGame
   */
  name: string;

  /**
   * path to the image that is to be used as the logo for this game.
   * Please note: The logo should be easily recognizable and distinguishable from
   * other games of the same series.
   * Preferably the logo should *not* contain the game name because NMM will display
   * the name as text near the logo. This way the name can be localised.
   * Background should be transparent. The logo will be resized preserving aspect
   * ratio, the canvas has a 3:4 (portrait) ratio.
   * 
   * @type {string}
   * @memberOf IGame
   */
  logo: string;

  /**
   * path to the game extension and assets included with it. This is automatically
   * set on loading the extension and and pre-set value is ignored
   * 
   * @type {string}
   * @memberOf IGame
   */
  pluginPath?: string;

}
