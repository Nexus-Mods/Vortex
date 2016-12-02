import {IExtensionContext} from '../../types/IExtensionContext';
import {ITableAttribute} from '../../types/ITableAttribute';

import {IDownload} from '../download_management/types/IDownload';

import {addMod, clearMods} from './actions/mods';
import {modsReducer} from './reducers/mods';
import {settingsReducer} from './reducers/settings';
import {IInstall} from './types/IInstall';
import {IMod} from './types/IMod';
import {IModActivator} from './types/IModActivator';
import {IStatePaths} from './types/IStateSettings';
import {ITestSupported} from './types/ITestSupported';
import * as basicInstaller from './util/basicInstaller';
import refreshMods from './util/refreshMods';
import ActivationButton from './views/ActivationButton';
import DeactivationButton from './views/DeactivationButton';
import ModList from './views/ModList';
import Settings from './views/Settings';

import InstallManager from './InstallManager';

import {INSTALL_TIME, MOD_NAME, VERSION} from './modAttributes';
import {installPath} from './selectors';

import {log} from '../../util/log';

let activators: IModActivator[] = [];

let installManager: InstallManager;

export interface IExtensionContextExt extends IExtensionContext {
  registerModAttribute: (attribute: ITableAttribute) => void;
}

function registerModActivator(activator: IModActivator) {
  activators.push(activator);
}

function registerInstaller(priority: number, testSupported: ITestSupported, install: IInstall) {
  installManager.addInstaller(priority, testSupported, install);
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

function init(context: IExtensionContextExt): boolean {
  if ((installManager === undefined) && (context.api.store !== undefined)) {
    const store = context.api.store;

    installManager = new InstallManager(() => installPath(store.getState()) );
  }

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

  context.registerExtensionFunction('registerInstaller', registerInstaller);

  if (context.registerModAttribute !== undefined) {
    context.registerModAttribute(MOD_NAME);
    context.registerModAttribute(VERSION);
    context.registerModAttribute(INSTALL_TIME);
  }

  context.once(() => {
    const store: Redux.Store<any> = context.api.store;

    context.api.events.on('gamemode-activated', (newGame: string) => {
      context.api.store.dispatch(clearMods());
      refreshMods(installPath(store.getState()), (mod: IMod) => {
        if (store.getState().mods[mod.id] === undefined) {
          context.api.store.dispatch(addMod(mod));
        }
      })
      .then(() => {
        context.api.events.emit('mods-refreshed');
      })
      ;
    });

    context.api.onStateChange(
        ['gameSettings', 'mods', 'paths'],
        (previous: IStatePaths, current: IStatePaths) => {
          store.dispatch(clearMods());
          refreshMods(installPath(store.getState()), (mod: IMod) => {
            if (store.getState().mods[mod.id] === undefined) {
              context.api.store.dispatch(addMod(mod));
            }
          });
        });

    context.api.events.on(
        'start-install',
        (archivePath: string, callback?: (error, id: string) => void) => {
          installManager.install(null, archivePath, context, {}, true, callback);
        });

    context.api.events.on(
        'start-install-download',
        (downloadId: string, callback?: (error, id: string) => void) => {
          let download: IDownload =
              store.getState().persistent.downloads.files[downloadId];
          installManager.install(downloadId, download.localPath, context,
                                 download.modInfo, true, callback);
        });
    registerInstaller(1000, basicInstaller.testSupported, basicInstaller.install);
  });

  return true;
}

export default init;
