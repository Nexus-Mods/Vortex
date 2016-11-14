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

import * as fs from 'fs';
import * as path from 'path';

import {ILookupResult} from 'modmeta-db';

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
  transfer(result, 'version', input.meta, ['fileVersion']);
  transfer(result, 'logicalFileName', input.meta, ['logicalFileName']);

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
                      context: IExtensionContext, info: any) {
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
        fullInfo.meta = modInfo[0].value;
        const installName = deriveInstallName(baseName, fullInfo);
        destinationPath = path.join(installPath, installName);
        installContext.setInstallPathCB(baseName, destinationPath);
        return installArchiveImpl(archivePath, destinationPath);
      })
      .then(() => {
        const filteredInfo = filterModInfo(fullInfo);
        installContext.finishInstallCB(baseName, true, filteredInfo);
      })
      .catch((err) => {
        installContext.reportError('failed to extract', err.message);
        installContext.finishInstallCB(baseName, false);
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
          // system
          //   to read game-specific settings. This delay is not a proper
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

    context.api.events.on('start-install', (archivePath: string) => {
      startInstall(archivePath, installPath(store.getState()), context, {});
    });

    context.api.events.on('start-install-download', (downloadId: string) => {
      let download: IDownload = store.getState().persistent.downloads.files[downloadId];
      startInstall(download.localPath, installPath(store.getState()), context, download.modInfo);
    });
  });

  return true;
}

export default init;
