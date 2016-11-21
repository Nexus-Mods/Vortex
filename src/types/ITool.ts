import * as Promise from 'bluebird';

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
   * path to the image that is to be used as the logo for this tool.
   * Please note: The logo should be easily recognizable and distinguishable from
   * other tools.
   * For game logos consider this:
   *  - it is especially important to consider distinguishability between different
   *    games of the same series.
   *  - Preferably the logo should *not* contain the game name because NMM will display
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
   * it should definitively be the valid game path. Usually this function
   * will query the path from the registry or from steam.
   * This function may return a promise and it should do that if it's doing I/O
   * 
   * This may be left undefined but then the tool/game can only be discovered
   * by searching the disk which is slow and only happens manually.
   * 
   */
  queryPath?: () => string | Promise<string>;

  /**
   * return the path of the tool executable relative to the tool base path,
   * i.e. binaries/UT3.exe or TESV.exe
   * This is a function so that you can return different things based on
   * the operating system but if at all possible this should return immediately without
   * doing I/O.
   */
  executable: () => string;

  /**
   * list of files that have to exist in the directory of this tool.
   * This is used by the discovery to identify the tool/game. NMM will only accept
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
   * this is the case so that NMM can correctly identify the base directory.
   * 
   * You can actually use a directory name for this as well.
   * 
   * Prefer to NOT use executables because those will differ between operating systems
   * so if the tool/game is multi-platform better use a data file.
   * 
   * @type {string[]}
   */
  requiredFiles: string[];
}
