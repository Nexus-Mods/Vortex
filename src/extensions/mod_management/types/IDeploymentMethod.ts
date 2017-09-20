import { IMod } from './IMod';

import * as Promise from 'bluebird';
import * as I18next from 'i18next';

/**
 * details about a file change
 */
export interface IFileChange {
  /**
   * relative path to the changed file
   */
  filePath: string;
  /**
   * the source mod
   */
  source: string;
  /**
   * type of change.
   * refchange means that the installed file
   *   now references a different object. This could happen if a
   *   file was installed/overwritten by a different application
   *   or the file was changed by an application that didn't edit
   *   in-place (most applications will write to a temporary file
   *   and, on success, move the temp file over the original, thus
   *   creating a new file entry)
   * valchange means that the content of the file was changed
   *   in-place (as in: file was opened and then written to)
   * deleted means that the file was deleted
   */
  changeType: 'refchange' | 'valchange' | 'deleted';
}

export interface IDeployedFile {
  /**
   * the relative path to the file
   */
  relPath: string;
  /**
   * the source of the file, which should be the name of the mod
   */
  source: string;
  /**
   * the last-modified time of the file. This can be used to determine if the file
   * was changed after deployment
   */
  time: number;
  // TODO: implement md5-hash in case file time is found to be an insufficient
  //   criterium
}

export interface IDeploymentMethod {

  /**
   * id of the activator for lookup in code
   *
   * @type {string}
   * @memberOf IModActivator
   */
  readonly id: string;

  /**
   * name of this activator as presented to the user
   *
   * @type {string}
   * @memberOf IModActivator
   */
  readonly name: string;

  /**
   * Short description of the activator and it's pros/cons
   *
   * @type {string}
   * @memberOf IModActivator
   */
  readonly description: string;

  /**
   * returns more extensive description/explanation of the activator.
   *
   * @type {string}
   * @memberOf IModActivator
   */
  detailedDescription: (t: I18next.TranslationFunction) => string;

  /**
   * determine if this activator is supported in the current environment
   * If the activator is supported, returns undefined. Otherwise a string
   * that explains why the activator isn't available.
   *
   * synchronous 'cause lazy.
   *
   * @memberOf IModActivator
   */
  isSupported: (state: any, gameId: string, modTypeId: string) => string;

  /**
   * if mod deployment in some way requires user interaction we should give the user control
   * over the process, even if he has auto-deploy active
   *
   * @memberof IModActivator
   */
  userGate: () => Promise<void>;

  /**
   * called before any calls to activate/deactivate, in case the
   * activator needs to do pre-processing
   * @param {string} dataPath the path where files will be deployed to
   * @param {boolean} clean whether the activate commands should be treated
   *                        as deltas (false) to the existing activation or whether
   *                        we're deploying from scratch (true)
   * @param {IDeployedFile[]} lastActivation previous deployment state to be used as
   *                                         the reference for newly deployed files
   *
   * @memberOf IModActivator
   */
  prepare: (dataPath: string, clean: boolean, lastActivation: IDeployedFile[]) => Promise<void>;

  /**
   * called after an activate call was made for all active mods,
   * in case this activator needs to do postprocessing
   *
   * @return {} a promise of activation results. These results will be used for a "purge"
   *            in case the activator isn't available for the regular purge op.
   *            If a purge isn't necessary, i.e. because the links are transient anyway, please
   *            just return an empty list.
   *            Please note that this purge will happen with a regular file deletion call,
   *            if this could lead to data loss do NOT return anything here. In that case you
   *            should provide another way for the user to clean up the game directory even when
   *            your activator is not available for some reason.
   *
   * @memberOf IModActivator
   */
  finalize: (dataPath: string) => Promise<IDeployedFile[]>;

  /**
   * activate the specified mod in the specified location
   * @param {string} sourcePath source where the mod is installed
   * @param {string} sourceName name to be stored as the source of files. usually the path of the
   *                            mod subdirectory
   * @param {string} dataPath game path where mods are installed to (destination)
   * @param {string[]} blacklist list of files to skip
   *
   * @memberOf IModActivator
   */
  activate: (sourcePath: string, sourceName: string, dataPath: string,
             blackList: Set<string>) => Promise<void>;

  /**
   * deactivate the specified mod, removing all files it has deployed to the destination
   */
  deactivate: (installPath: string, dataPath: string, mod: IMod) => Promise<void>;

  /**
   * deactivate all mods at the destination location
   * @param {string} installPath Vortex path where mods are installed from (source)
   * @param {string} dataPath game paths where mods are installed to (destination)
   * Vortex itself does not keep track which files were installed by the
   * activator so if the activator can not discover those automatically it
   * it has to do its own bookkeeping.
   * The LinkingActivator base-class does implement such bookkeeping however.
   *
   * @memberOf IModActivator
   */
  purge: (installPath: string, dataPath: string) => Promise<void>;

  /**
   * retrieve list of external changes, that is: files that were installed by this
   * activator but have been changed since then by an external application.
   * @param {string} installPath Vortex path where mods are installed from (source)
   * @param {string} dataPath game path where mods are installed to (destination)
   *
   * @memberOf IModActivator
   */
  externalChanges: (installPath: string, dataPath: string,
                    activation: IDeployedFile[]) => Promise<IFileChange[]>;

  /**
   * returns whether this mod activator currently has mods activated in the
   * game directory
   *
   * @memberOf IModActivator
   */
  isActive: () => boolean;
}
