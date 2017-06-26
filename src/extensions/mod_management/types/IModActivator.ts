import { IMod } from './IMod';

import * as Promise from 'bluebird';

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

export interface IModActivator {

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
   * determine if this activator is supported in the current environment
   * If the activator is supported, returns undefined. Otherwise a string
   * that explains why the activator isn't available.
   *
   * synchronous 'cause lazy.
   *
   * @memberOf IModActivator
   */
  isSupported: (state: any) => string;

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
   *
   * @memberOf IModActivator
   */
  prepare: (dataPath: string, clean: boolean) => Promise<void>;

  /**
   * called after an activate call was made for all active mods,
   * in case this activator needs to do postprocessing
   *
   * @memberOf IModActivator
   */
  finalize: (dataPath: string) => Promise<void>;

  /**
   * activate the specified mod in the specified location
   * @param {string} installPath Vortex path where mods are installed from (source)
   * @param {string} dataPath game path where mods are installed to (destination)
   * @param {string} mod the mod to activate
   *
   * @memberOf IModActivator
   */
  activate: (installPath: string, dataPath: string, mod: IMod) => Promise<void>;

  /**
   * deactivate the specified mod, removing all files it has deployed to the destination
   */
  deactivate: (installPath: string, dataPath: string, mod: IMod) => Promise<void>;

  /**
   * deactivate all mods at the destination location
   * @param {string} installPath Vortex path where mods are installed from (source)
   * @param {string} dataPath game path where mods are installed to (destination)
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
  externalChanges: (installPath: string, dataPath: string) => Promise<IFileChange[]>;

  /**
   * forget a set of files, that is: if the this activator keeps track of activation.
   * This is used to correct the record if "externalChanges()" indicates a file was
   * activated but is no longer there.
   * Therefore if externalChanges is implemented, so should forgetFiles
   */
  forgetFiles: (filePaths: string[]) => Promise<void>;

  /**
   * returns whether this mod activator currently has mods activated in the
   * game directory
   *
   * @memberOf IModActivator
   */
  isActive: () => boolean;
}
