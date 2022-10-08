import Bluebird from 'bluebird';
import { IGameStoreEntry } from './IGameStoreEntry';

/**
 * static information about a tool associated with a game.
 * This info is used to discover such tools and to store that
 * data after discovery
 * It is also the base class for the IGame structure, representing
 * the games themselves
 *
 * @export
 * @interface ITool
 */
export interface ITool {
  /**
   * internal name of the tool
   *
   * @type {string}
   */
  id: string;

  /**
   * human readable name used in presentation to the user
   *
   * @type {string}
   */
  name: string;

  /**
   * short/abbreviated variant of the name, still intended for presentation to the user
   * this is used when available space is limited. Try to keep it below 8 characters
   * (there is no fixed limit but layout may break if this is too long)
   * If none is set, falls back to name
   */
  shortName?: string;

  /**
   * path to the image that is to be used as the logo for this tool.
   * Please note: The logo should be easily recognizable and distinguishable from
   * other tools.
   * For game logos consider this:
   *  - it is especially important to consider distinguishability between different
   *    games of the same series.
   *  - Preferably the logo should *not* contain the game name because Vortex will display
   *    the name as text near the logo. This way the name can be localised.
   *  - Background should be transparent. The logo will be resized preserving aspect
   *    ratio, the canvas has a 3:4 (portrait) ratio.
   *
   * @type {string}
   */
  logo?: string;

  /**
   * determine installation path of this tool/game
   * This function should return quickly and, if it returns a value,
   * it should definitively be the valid tool/game path. Usually this function
   * will query the path from the registry or from steam.
   * This function may return a promise and it should do that if it's doing I/O
   *
   * This may be left undefined but then the tool/game can only be discovered
   * by searching the disk which is slow and only happens manually.
   */
  queryPath?: () => string | Bluebird<string | IGameStoreEntry>;

  /**
   * return the path of the tool executable relative to the tool base path,
   * i.e. binaries/UT3.exe or TESV.exe
   * This is a function so that you can return different things based on
   * the operating system for example but be aware that it will be evaluated at
   * application start and only once, so the return value can not depend on things
   * that change at runtime.
   *
   * Optional: Game extensions are free to ignore the parameter and they have
   *   to work if the parameter is undefined.
   *   executable will be called with the parameter set at the time the game is discovered.
   *   If there are multiple versions of the game with different executables, it can return
   *   the correct executable based on the variant installed.
   *   This is a synchronous function so game extensions will probably want to use something
   *   like fs.statSync to text for file existance
   */
  executable: (discoveredPath?: string) => string;

  /**
   * list of files that have to exist in the directory of this tool.
   * This is used by the discovery to identify the tool/game. Vortex will only accept
   * a directory as the tool directory if all these files exist.
   * Please make sure the files listed here uniquely identify the tool, something
   * like 'rpg_rt.exe' would not suffice (rpg_rt.exe is the binary name of a game
   * engine and appears in many games).
   *
   * Please specify as few files as possible, the more files specified here the slower
   * the discovery will be.
   *
   * Each file can be specified as a relative path (i.e. binaries/UT3.exe), the path
   * is then assumed to be relative to the base directory of the application. It's important
   * this is the case so that Vortex can correctly identify the base directory.
   *
   * You can actually use a directory name for this as well.
   *
   * Prefer to NOT use executables because those will differ between operating systems
   * so if the tool/game is multi-platform better use a data file.
   *
   * @type {string[]}
   */
  requiredFiles: string[];

  /**
   * list of parameters to pass to the tool
   *
   * @type {string[]}
   * @memberOf ITool
   */
  parameters?: string[];

  /**
   * variables to add to the environment when starting this exe. These are in addition to
   * (and replacing) existing variables that would be passed automatically.
   */
  environment?: { [key: string]: string };

  /**
   * if true, the tool is expected to be installed relative to the game directory. Otherwise
   * the tool will be detected anywhere on the disk.
   */
  relative?: boolean;

  /**
   * if true, the tool will be run inside a shell
   */
  shell?: boolean;

  /**
   * if true, running this tool will block any other applications be run from vortex until it's
   * done. Defaults to false
   */
  exclusive?: boolean;

  /**
   * if set to true the process tool will be launched detached, that is: not part of Vortex's
   * process hierarchy
   */
  detach?: boolean;

  /**
   * if this tool is installed, use it as the primary tool (unless the user has manually set a
   * primary of course)
   * If multiple tools with this flag are installed it's effectively random which one gets picked,
   * we make no promises on any kind of consistency
   */
  defaultPrimary?: boolean;

  /**
   * what to do with Vortex when starting the tool. Default is to do nothing. 'hide' will minimize
   * Vortex and 'close' will make Vortex quit as soon as the tool is started.
   */
  onStart?: 'hide' | 'hide_recover' | 'close';
}
