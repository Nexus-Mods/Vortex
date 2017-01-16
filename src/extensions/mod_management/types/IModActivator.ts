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
   *   and on success move the temp file over the original, thus
   *   creating a new file entry)
   * valchange means that the content of the file was changed
   *   in-place (as in: file was opened and then written to)
   */
  changeType: 'refchange' | 'valchange';
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
   * 
   * synchronous 'cause lazy.
   * 
   * @memberOf IModActivator
   */
  isSupported: (state: any) => boolean;

  /**
   * called before any calls to activate, in case the
   * activator needs to do pre-processing
   * 
   * @memberOf IModActivator
   */
  prepare: (dataPath: string) => Promise<void>;

  /**
   * called after an activate call was made for all active mods,
   * in case this activator needs to do postprocessing
   * 
   * @memberOf IModActivator
   */
  finalize: (dataPath: string) => Promise<void>;

  /**
   * activate the specified mod in the specified location
   * @param {string} installPath nmm2 path where mods are installed from (source)
   * @param {string} dataPath game path where mods are installed to (destination)
   * @param {string} mod the mod to activate
   * 
   * @memberOf IModActivator
   */
  activate: (installPath: string, dataPath: string, mod: IMod) => Promise<void>;

  /**
   * deactivate all mods at the destination location
   * @param {string} installPath nmm2 path where mods are installed from (source)
   * @param {string} dataPath game path where mods are installed to (destination)
   * NMM2 itself does not keep track which files were installed by the
   * activator so if the activator can not discover those automatically it
   * it has to do its own bookkeeping.
   * The LinkingActivator base-class does implement such bookkeeping however and
   * this extension does provide reducers to store an activation snapshot.
   * 
   * @memberOf IModActivator
   */
  purge: (installPath: string, dataPath: string) => Promise<void>;

  /**
   * retrieve list of external changes, that is: files that were installed by this
   * activator but have been changed since then by an external application.
   * @param {string} installPath nmm2 path where mods are installed from (source)
   * @param {string} dataPath game path where mods are installed to (destination)
   * 
   * @memberOf IModActivator
   */
  externalChanges: (installPath: string, dataPath: string) => Promise<IFileChange[]>;

  /**
   * returns whether this mod activator currently has mods activated in the
   * game directory
   * 
   * @memberOf IModActivator
   */
  isActive: () => boolean;
}
