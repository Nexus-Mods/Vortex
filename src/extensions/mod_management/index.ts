import {IExtensionContext} from '../../types/IExtensionContext';
import {ITableAttribute} from '../../types/ITableAttribute';

import {IDownload} from '../download_management/types/IDownload';

import {addMod, removeMod} from './actions/mods';
import {setActivator} from './actions/settings';
import {modsReducer} from './reducers/mods';
import {settingsReducer} from './reducers/settings';
import {IInstall} from './types/IInstall';
import {IMod} from './types/IMod';
import {IModActivator} from './types/IModActivator';
import {IStatePaths} from './types/IStateSettings';
import {ITestSupported} from './types/ITestSupported';
import * as basicInstaller from './util/basicInstaller';
import refreshMods from './util/refreshMods';
import supportedActivators from './util/supportedActivators';
import ActivationButton from './views/ActivationButton';
import DeactivationButton from './views/DeactivationButton';
import ModList from './views/ModList';
import Settings from './views/Settings';

import InstallManager from './InstallManager';

import {CATEGORY, CATEGORY_DETAIL, INSTALL_TIME, MOD_NAME, VERSION} from './modAttributes';
import {downloadPath, installPath} from './selectors';

import * as path from 'path';

import {log} from '../../util/log';

let activators: IModActivator[] = [];

let installManager: InstallManager;

interface IInstaller {
  priority: number;
  testSupported: ITestSupported;
  install: IInstall;
}

let installers: IInstaller[] = [];

export interface IExtensionContextExt extends IExtensionContext {
  registerModAttribute: (attribute: ITableAttribute) => void;
  registerModActivator: (activator: IModActivator) => void;
  registerInstaller: (priority: number, testSupported: ITestSupported, install: IInstall) => void;
}

function registerModActivator(activator: IModActivator) {
  activators.push(activator);
}

function registerInstaller(priority: number, testSupported: ITestSupported, install: IInstall) {
  installers.push({ priority, testSupported, install });
}

function init(context: IExtensionContextExt): boolean {
  context.registerMainPage('cubes', 'Mods', ModList, {
    hotkey: 'M',
  });

  context.registerIcon('application-icons', ActivationButton, () => {
    return {
      key: 'activate-button',
      activators,
    };
  });

  context.registerIcon('application-icons', DeactivationButton, () => {
    return {
      key: 'deactivate-button',
      activators,
    };
  });

  context.registerSettings('Mods', Settings, () => {
    return {activators};
  });

  context.registerSettingsHive('game', 'mods');

  context.registerReducer(['mods'], modsReducer);
  context.registerReducer(['gameSettings', 'mods'], settingsReducer);

  context.registerModActivator = registerModActivator;
  context.registerInstaller = registerInstaller;

  context.optional.registerModAttribute(MOD_NAME);
  context.optional.registerModAttribute(VERSION);
  context.optional.registerModAttribute(INSTALL_TIME);
  context.optional.registerModAttribute(CATEGORY);
  context.optional.registerModAttribute(CATEGORY_DETAIL);

  context.once(() => {
    const store: Redux.Store<any> = context.api.store;

    if (installManager === undefined) {
      installManager = new InstallManager(() => installPath(store.getState()));
      installers.forEach((installer: IInstaller) => {
        installManager.addInstaller(installer.priority, installer.testSupported, installer.install);
      });
    }

    context.api.events.on('gamemode-activated', (newGame: string) => {
      let currentActivator = store.getState().gameSettings.mods.activator;
      let supported = supportedActivators(activators, store.getState());
      if (supported.find((activator: IModActivator) =>
        activator.id === currentActivator) === undefined) {
        // current activator is not valid for this game. This should only occur
        // if compatibility of the activator has changed
        if (supported.length > 0) {
          context.api.store.dispatch(setActivator(supported[0].id));
        }
      }

      let knownMods = Object.keys(store.getState().mods.mods);
      refreshMods(installPath(store.getState()), knownMods, (mod: IMod) => {
        context.api.store.dispatch(addMod(mod));
      }, (modNames: string[]) => {
        modNames.forEach((name: string) => { context.api.store.dispatch(removeMod(name)); });
      })
        .then(() => {
          context.api.events.emit('mods-refreshed');
        })
        ;
    });

    context.api.onStateChange(
      ['gameSettings', 'mods', 'paths'],
      (previous: IStatePaths, current: IStatePaths) => {
        let knownMods = Object.keys(store.getState().mods.mods);
        refreshMods(installPath(store.getState()), knownMods, (mod: IMod) => {
          context.api.store.dispatch(addMod(mod));
        }, (modNames: string[]) => {
          modNames.forEach((name: string) => { context.api.store.dispatch(removeMod(name)); });
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
          let fullPath: string = path.join(downloadPath(store.getState()), download.localPath);
          installManager.install(downloadId, fullPath, context,
                                 download.modInfo, true, callback);
        });
    registerInstaller(1000, basicInstaller.testSupported, basicInstaller.install);
  });

  return true;
}

export default init;
