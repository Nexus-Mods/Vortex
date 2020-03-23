import { IExtensionApi } from '../../../types/IExtensionContext';
import { Normalize } from '../../../util/getNormalizeFunc';
import { TFunction } from '../../../util/i18n';

import Promise from 'bluebird';

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
   * deleted means that the file was deleted in the destination directory
   * srcdeleted means that the file was deleted in the source directory
   */
  changeType: 'refchange' | 'valchange' | 'deleted' | 'srcdeleted';
  /**
   * time the deployed file was last changed
   */
  destTime?: Date;
  /**
   * time the staging file was last changed
   */
  sourceTime?: Date;
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
   * if this file was created by merging, this lists all mods which were the basis of
   * the merge
   * deployment methods don't have to set this, it will be filled in by the the core
   * functionality
   */
  merged?: string[];
  /**
   * the output directory for the file. This will be empty for games that put all mods
   * in the same directory (mergeMods is true).
   */
  target?: string;
  /**
   * the last-modified time of the file. This can be used to determine if the file
   * was changed after deployment
   */
  time: number;
  // TODO: implement md5-hash in case file time is found to be an insufficient
  //   criterium
}

/**
 * Indicates why a deployment method is unavailable an if it can be made to work
 */
export interface IUnavailableReason {
  /**
   * description (english) why the deployment method is unavailable
   */
  description: (t: TFunction) => string;
  /**
   * describes the solution to make this
   */
  solution?: (t: TFunction) => string;
  /**
   * if the problem can be fixed automatically, this can be set to a function that takes care
   * of it
   */
  fixCallback?: (api: IExtensionApi) => Promise<void>;
  /**
   * When no method is supported, Vortex will offer possible solutions in this order.
   * It should indicate both how much effort the solution is and also a general preference for
   * this deployment methods so that the preferred method has a lower order number than others.
   */
  order?: number;
}

export interface IDeploymentMethod {

  /**
   * id of the activator for lookup in code
   *
   * @type {string}
   * @memberOf IDeploymentMethod
   */
  readonly id: string;

  /**
   * name of this activator as presented to the user
   *
   * @type {string}
   * @memberOf IDeploymentMethod
   */
  readonly name: string;

  /**
   * Short description of the activator and it's pros/cons
   *
   * @type {string}
   * @memberOf IDeploymentMethod
   */
  readonly description: string;

  /**
   * true if it's "safe" to purge files from this method from another instance,
   * that is: without knowing where the "original" files are.
   *
   * @type {boolean}
   * @memberOf IDeploymentMethod
   */
  readonly isFallbackPurgeSafe: boolean;

  /**
   * low value means: prefer this method over those with higher value
   */
  readonly priority: number;

  /**
   * returns more extensive description/explanation of the activator.
   *
   * @type {string}
   * @memberOf IDeploymentMethod
   */
  detailedDescription: (t: TFunction) => string;

  /**
   * determine if this activator is supported in the current environment
   * If the activator is supported, returns undefined. Otherwise a string
   * that explains why the activator isn't available.
   *
   * synchronous 'cause lazy.
   *
   * @memberOf IDeploymentMethod
   */
  isSupported: (state: any, gameId: string, modTypeId: string) => IUnavailableReason;

  /**
   * if mod deployment in some way requires user interaction we should give the user control
   * over the process, even if he has auto-deploy active
   *
   * @memberof IDeploymentMethod
   */
  userGate: () => Promise<void>;

  /**
   * called before the deployment method is selected. Primary use is to show usage instructions
   * the user needs to know before using it
   */
  onSelected?: (api: IExtensionApi) => Promise<void>;

  /**
   * called before any calls to activate/deactivate, in case the
   * activator needs to do pre-processing
   * @param {string} dataPath the path where files will be deployed to
   * @param {boolean} clean whether the activate commands should be treated
   *                        as deltas (false) to the existing activation or whether
   *                        we're deploying from scratch (true)
   * @param {IDeployedFile[]} lastActivation previous deployment state to be used as
   *                                         the reference for newly deployed files
   * @param {Normalize} normalize a path normalization function. This needs to be used
   *                              when comparing strings against the blacklist or when storing
   *                              relative path into the deployment manifest
   *
   * @memberOf IDeploymentMethod
   */
  prepare: (dataPath: string, clean: boolean, lastActivation: IDeployedFile[],
            normalize: Normalize) => Promise<void>;

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
   * @memberOf IDeploymentMethod
   */
  finalize: (gameId: string,
             dataPath: string,
             installationPath: string,
             progressCB?: (files: number, total: number) => void) => Promise<IDeployedFile[]>;

  /**
   * if defined, this gets called instead of finalize if an error occurred since prepare was called.
   * This allows the deployment method to reset all state without actually doing anything in case
   * things went wrong.
   * If this is not defined, nothing gets called. In this case the deployment method can't have any
   * state set up in prepare that would cause issues if finalize doesn't get called.
   */
  cancel?: (gameId: string,
            dataPath: string,
            installationPath: string) => Promise<void>;

  /**
   * activate the specified mod in the specified location
   * @param {string} sourcePath source where the mod is installed
   * @param {string} sourceName name to be stored as the source of files. usually the path of the
   *                            mod subdirectory
   * @param {string} dataPath relative path within the data path where mods are installed to
   * @param {Set<string>} blacklist list of files to skip
   *
   * @memberOf IDeploymentMethod
   */
  activate: (sourcePath: string, sourceName: string, dataPath: string,
             blackList: Set<string>) => Promise<void>;

  /**
   * deactivate the specified mod, removing all files it has deployed to the destination
   * @param {string} sourcePath source where the mod is installed
   * @param {string} dataPath relative path within the data path where mods are installed to
   * @param {string} sourceName name of the source mod
   *
   * @todo sorry about the stupid parameter order, sourceName was added after release so to
   *   remain backwards compatible we have to append it
   */
  deactivate: (sourcePath: string, dataPath: string, sourceName: string) => Promise<void>;

  /**
   * called before mods are being purged. If multiple mod types are going to be purged,
   * this is only called once.
   * This is primarily useful for optimization, to avoid work being done redundantly
   * for every modtype-purge
   */
  prePurge: (installPath: string) => Promise<void>;

  /**
   * deactivate all mods at the destination location
   * @param {string} installPath Vortex path where mods are installed from (source)
   * @param {string} dataPath game paths where mods are installed to (destination)
   * Vortex itself does not keep track which files were installed by the
   * activator so if the activator can not discover those automatically it
   * it has to do its own bookkeeping.
   * The LinkingActivator base-class does implement such bookkeeping however.
   *
   * @memberOf IDeploymentMethod
   */
  purge: (installPath: string, dataPath: string, gameId?: string) => Promise<void>;

  /**
   * called after mods were purged. If multiple mod types wer purged, this is only called
   * after they are all done.
   * Like prePurge, this is intended for optimizations
   */
  postPurge: () => Promise<void>;

  /**
   * retrieve list of external changes, that is: files that were installed by this
   * activator but have been changed since then by an external application.
   * @param {string} installPath Vortex path where mods are installed from (source)
   * @param {string} dataPath game path where mods are installed to (destination)
   *
   * @memberOf IDeploymentMethod
   */
  externalChanges: (gameId: string, installPath: string, dataPath: string,
                    activation: IDeployedFile[]) => Promise<IFileChange[]>;

  /**
   * given a file path (relative to a staging path), return the name under which the
   * file would be deployed.
   * This is used in cases where the deployment method may rename files during
   * deployment for whatever reason.
   * An example would be move deployment where the file that remains in the staging
   * folder is just a (differently named) placeholder.
   */
  getDeployedPath: (input: string) => string;

  /**
   * test if the specified file is deployed through this methed
   * @param {string} installPath Vortex path where mods are installed from (source)
   * @param {string} dataPath game path where mods are installed to (destination)
   */
  isDeployed: (installPath: string, dataPath: string, file: IDeployedFile) => Promise<boolean>;
}
