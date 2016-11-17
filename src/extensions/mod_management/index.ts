import {showDialog} from '../../actions/notifications';
import {IExtensionContext} from '../../types/IExtensionContext';
import {getSafe} from '../../util/storeHelper';

import {IDownload} from '../download_management/types/IDownload';

import {addMod, clearMods} from './actions/mods';
import {modsReducer} from './reducers/mods';
import {settingsReducer} from './reducers/settings';
import {IMod} from './types/IMod';
import {IModActivator} from './types/IModActivator';
import {IModAttribute} from './types/IModAttribute';
import {IStatePaths} from './types/IStateSettings';
import ActivationButton from './views/ActivationButton';
import DeactivationButton from './views/DeactivationButton';
import ModList from './views/ModList';
import Settings from './views/Settings';

import InstallContext from './InstallContext';
import {installArchive} from './modInstall';

import {INSTALL_TIME, MOD_NAME, VERSION} from './modAttributes';

import * as Promise from 'bluebird';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

import {ILookupResult, IReference, IRule} from 'modmeta-db';

import {log} from '../../util/log';

let activators: IModActivator[] = [];

export interface IExtensionContextExt extends IExtensionContext {
  registerModAttribute: (attribute: IModAttribute) => void;
}

function registerModActivator(activator: IModActivator) {
  activators.push(activator);
}

function refreshMods(installDir: string, onAddMod: (mod: IMod) => void) {
  fs.readdir(installDir, (err: NodeJS.ErrnoException, mods: string[]) => {
    if (mods === undefined) {
      return;
    }
    mods.forEach((modName: string) => {
      const fullPath: string = path.join(installDir, modName);
      const mod: IMod = {
        id: modName,
        installationPath: fullPath,
        state: 'installed',
        attributes: {
          name: modName,
          installTime: fs.statSync(fullPath).birthtime,
        },
      };
      onAddMod(mod);
    });
  });
}

/**
 * return only those activators that are supported based on the current state
 * TODO: this may be a costy operation if we do it ever time the list is
 * requested.
 *       we may want to limit what state activators may depend on and then only
 *       recalculate the list if that state changes
 *
 * @param {*} state
 * @returns {IModActivator[]}
 */
function supportedActivators(state: any): IModActivator[] {
  return activators.filter(
      (activator: IModActivator) => { return activator.isSupported(state); });
}

/**
 * determine the mod name (on disk) from the archive path
 * TODO: this currently simply uses the archive name which should be fine
 *   for downloads from nexus but in general we need the path to encode the mod,
 *   the specific "component" and the version. And then we need to avoid
 * collisions.
 *   Finally, the way I know users they will want to customize this.
 *
 * @param {string} archiveName
 * @param {*} info
 * @returns
 */
function deriveInstallName(archiveName: string, info: any) {
  return archiveName;
}

function transfer(info: any, key: string, source: any, path: string[]) {
  let value = getSafe(source, path, undefined);
  if (value !== undefined) {
    info[key] = value;
  }
}

function filterModInfo(input: any): any {
  let result = {};

  // TODO these should be extensions 
  transfer(result, 'modId', input.nexus, ['ids', 'modId']);
  transfer(result, 'fileId', input.nexus, ['ids', 'fileId']);
  transfer(result, 'version', input.nexus, ['fileInfo', 'version']);
  transfer(result, 'logicalFileName', input.nexus, ['fileInfo', 'name']);

  transfer(result, 'modId', input.meta, ['modId']);
  transfer(result, 'modName', input.meta, ['modName']);
  transfer(result, 'fileName', input.meta, ['fileName']);
  transfer(result, 'fileMD5', input.meta, ['fileMD5']);
  transfer(result, 'version', input.meta, ['fileVersion']);
  transfer(result, 'logicalFileName', input.meta, ['logicalFileName']);
  transfer(result, 'rules', input.meta, ['rules']);

  return result;
}

/**
 * start installing a mod.
 *
 * @param {string} archivePath path to the archive file
 * @param {string} installPath path to install mods into (not including the mod
 * name)
 * @param {IExtensionContext} context extension context
 * @param {*} modInfo existing information about the mod (i.e. stuff retrieved
 * from nexus)
 */
function startInstall(archivePath: string, installPath: string,
                      context: IExtensionContext, info: any,
                      doDependencies: boolean,
                      callback?: (error, id: string) => void) {
  const installArchiveImpl: typeof installArchive =
      require('./modInstall').installArchive;
  const InstallContextImpl: typeof InstallContext =
      require('./InstallContext').default;

  const installContext = new InstallContextImpl(context.api.store.dispatch);

  const baseName = path.basename(archivePath, path.extname(archivePath));
  let destinationPath: string;
  let fullInfo = Object.assign({}, info);

  installContext.startInstallCB(baseName, archivePath, destinationPath);

  context.api.lookupModMeta(archivePath, {})
      .then((modInfo: ILookupResult[]) => {
        if (modInfo.length > 0) {
          fullInfo.meta = modInfo[0].value;
        }
        const installName = deriveInstallName(baseName, fullInfo);
        destinationPath = path.join(installPath, installName);
        installContext.setInstallPathCB(baseName, destinationPath);
        return installArchiveImpl(archivePath, destinationPath);
      })
      .then(() => {
        const filteredInfo = filterModInfo(fullInfo);
        installContext.finishInstallCB(baseName, true, filteredInfo);
        if (doDependencies) {
          installDependencies(filteredInfo.rules, installPath, installContext,
                              context);
        }
        if (callback !== undefined) {
          callback(null, baseName);
        }
      })
      .catch((err) => {
        installContext.reportError('failed to extract', err);
        installContext.finishInstallCB(baseName, false);
        if (callback !== undefined) {
          callback(err, baseName);
        }
      });
}

function findModByRef(reference: IReference, state: any): string {
  // TODO support non-hash references
  const mods = state.mods.mods;
  let existing: string = Object.keys(mods).find((modId: string): boolean => {
    return getSafe(mods[modId], ['attributes', 'fileMD5'], undefined) === reference.fileMD5;
  });
  return existing;
}

function findDownloadByRef(reference: IReference, state: any): string {
  // TODO support non-hash references
  const downloads = state.persistent.downloads.files;
  let existing: string = Object.keys(downloads).find((dlId: string): boolean => {
    return downloads[dlId].fileMD5 === reference.fileMD5;
  });
  return existing;
}

function downloadModAsync(requirement: IReference, sourceURI: string,
                          context: IExtensionContext): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (!context.api.events.emit('start-download', [sourceURI], {},
                                 (error, id) => {
                                   if (error === null) {
                                     resolve(id);
                                   } else {
                                     reject(error);
                                   }
                                 })) {
      reject(new Error('download manager not installed?'));
    }
  });
}

function installModAsync(requirement: IReference, context: IExtensionContext,
                         downloadId: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const {installPath} = require('./selectors');

    const state = context.api.store.getState();
    let download: IDownload = state.persistent.downloads.files[downloadId];
    startInstall(download.localPath, installPath(state), context,
                 download.modInfo, false, (error, id) => {
                   if (error === null) {
                     resolve(id);
                   } else {
                     reject(error);
                   }
                 });
  });
}

interface IDependency {
  download: string;
  reference: IReference;
  lookupResults: ILookupResult[];
}

function gatherDependencies(
    rules: IRule[], context: IExtensionContext): Promise<IDependency[]> {
  const state = context.api.store.getState();
  let requirements: IRule[] =
      rules === undefined ?
          [] :
          rules.filter((rule: IRule) => { return rule.type === 'requires'; });

  // for each requirement, look up the reference and recursively their dependencies
  return Promise.reduce(requirements, (total: IDependency[], rule: IRule) => {
    if (findModByRef(rule.reference, state)) {
      return total;
    }

    let lookupDetails: ILookupResult[];

    return context.api.lookupModReference(rule.reference)
        .then((details: ILookupResult[]) => {
          lookupDetails = details;

          if (details.length === 0) {
            throw new Error('reference not found: ' + rule.reference);
          }

          return gatherDependencies(details[0].value.rules, context);
        })
        .then((dependencies: IDependency[]) => {
          return total.concat(dependencies)
              .concat([
                {
                  download: findDownloadByRef(rule.reference, state),
                  reference: rule.reference,
                  lookupResults: lookupDetails,
                },
              ]);
        })
        .catch((err) => {
          log('error', 'failed to look up', err.message);
          return total;
        });
  }, []);
}

function doInstallDependencies(dependencies: IDependency[],
                               context: IExtensionContext): Promise<void> {
  return Promise.all(dependencies.map((dep: IDependency) => {
                  if (dep.download === undefined) {
                    return downloadModAsync(
                               dep.reference,
                               dep.lookupResults[0].value.sourceURI, context)
                        .then((downloadId: string) => {
                          return installModAsync(dep.reference, context,
                                                 downloadId);
                        });
                  } else {
                    return installModAsync(dep.reference, context,
                                           dep.download);
                  }
                }))
      .catch((err) => {
        context.api.showErrorNotification('Failed to install dependencies',
                                          err.message);
      })
      .then(() => undefined);
}

function installDependencies(rules: IRule[], installPath: string,
                             installContext: InstallContext,
                             context: IExtensionContext): Promise<void> {
  let notificationId = `${installPath}_activity`;
  context.api.sendNotification({
    id: notificationId,
    type: 'activity',
    message: 'Checking dependencies',
  });
  return gatherDependencies(rules, context)
  .then((dependencies: IDependency[]) => {
    context.api.dismissNotification(notificationId);
    let requiredDownloads = dependencies.reduce((prev: number, current: IDependency) => {
      return prev + (current.download ? 1 : 0);
    }, 0);

    return new Promise<void>((resolve, reject) => {
      let message = `This mod has unresolved dependencies. ${dependencies.length} mods have to be
installed, ${requiredDownloads} of them have to be downloaded first.`;

      context.api.store.dispatch(showDialog(
          'question', 'Install Dependencies', { message },
          {
            "Don't install": null,
            Install: () => doInstallDependencies(dependencies, context),
          }));
    });
  })
  .catch((err) => {
    context.api.dismissNotification(notificationId);
    context.api.showErrorNotification('Failed to check dependencies', err);
  });
}

function init(context: IExtensionContextExt): boolean {
  context.registerMainPage('cubes', 'Mods', ModList, {
    hotkey: 'M',
  });

  context.registerIcon('application-icons', ActivationButton, () => {
    return {
      key: 'activate-button',
      activators: supportedActivators(context.api.store.getState()),
    };
  });

  context.registerIcon('application-icons', DeactivationButton, () => {
    return {
      key: 'deactivate-button',
      activators: supportedActivators(context.api.store.getState()),
    };
  });

  context.registerSettings('Mods', Settings, () => {
    return {activators: supportedActivators(context.api.store.getState())};
  });

  context.registerReducer(['mods'], modsReducer);
  context.registerReducer(['gameSettings', 'mods'], settingsReducer);

  context.registerExtensionFunction('registerModActivator',
                                    registerModActivator);

  if (context.registerModAttribute !== undefined) {
    context.registerModAttribute(MOD_NAME);
    context.registerModAttribute(VERSION);
    context.registerModAttribute(INSTALL_TIME);
  }

  context.once(() => {
    const {installPath} = require('./selectors');

    const store: Redux.Store<any> = context.api.store;

    refreshMods(installPath(store.getState()), (mod: IMod): void => {
      if (store.getState().mods[mod.id] === undefined) {
        context.api.store.dispatch(addMod(mod));
      }
    });

    context.api.onStateChange(
        ['settings', 'gameMode', 'current'],
        (previous: string, current: string) => {
          // TODO after changing the game mode it may take a moment for the
          //   system to read game-specific settings. This delay is not a proper
          //   solution
          setTimeout(() => {
            context.api.store.dispatch(clearMods());
            refreshMods(installPath(store.getState()),
                        (mod: IMod) => {
                          if (store.getState().mods[mod.id] === undefined) {
                            context.api.store.dispatch(addMod(mod));
                          }
                        });
          }, 200);
        });

    context.api.onStateChange(['gameSettings', 'mods', 'paths'],
                              (previous: IStatePaths, current: IStatePaths) => {
                                store.dispatch(clearMods());
                                refreshMods(
                                    installPath(store.getState()),
                                    (mod: IMod) => {
                                      if (store.getState().mods[mod.id] === undefined) {
                                        context.api.store.dispatch(addMod(mod));
                                      }
                                    });
                              });

    context.api.events.on(
        'start-install',
        (archivePath: string, callback?: (error, id: string) => void) => {
          startInstall(archivePath, installPath(store.getState()), context, {},
                       true, callback);
        });

    context.api.events.on(
        'start-install-download',
        (downloadId: string, callback?: (error, id: string) => void) => {
          let download: IDownload =
              store.getState().persistent.downloads.files[downloadId];
          startInstall(download.localPath, installPath(store.getState()),
                       context, download.modInfo, true, callback);
        });
  });

  return true;
}

export default init;
