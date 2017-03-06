import {IExtensionContext} from '../../types/IExtensionContext';
import {ITableAttribute} from '../../types/ITableAttribute';
import {ITestResult} from '../../types/ITestResult';
import {
  activeGameId,
  activeProfile,
  currentActivator,
  currentGameDiscovery,
  downloadPath,
  installPath,
} from '../../util/selectors';
import {getSafe} from '../../util/storeHelper';

import {IDownload} from '../download_management/types/IDownload';

import {showExternalChanges} from './actions/externalChanges';
import {addMod, removeMod} from './actions/mods';
import {setActivator} from './actions/settings';
import {externalChangesReducer} from './reducers/externalChanges';
import {modsReducer} from './reducers/mods';
import {settingsReducer} from './reducers/settings';
import {IFileEntry} from './types/IFileEntry';
import {IInstall} from './types/IInstall';
import {IMod} from './types/IMod';
import {IFileChange, IModActivator} from './types/IModActivator';
import {IStatePaths} from './types/IStateSettings';
import {ITestSupported} from './types/ITestSupported';
import * as basicInstaller from './util/basicInstaller';
import refreshMods from './util/refreshMods';
import sortMods from './util/sort';
import supportedActivators from './util/supportedActivators';
import UserCanceled from './util/UserCanceled';
import ActivationButton from './views/ActivationButton';
import DeactivationButton from './views/DeactivationButton';
import ExternalChangeDialog from './views/ExternalChangeDialog';
import ModList from './views/ModList';
import Settings from './views/Settings';

import InstallManager from './InstallManager';
import { activateMods } from './modActivation';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import { generate as shortid } from 'shortid';

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

function updateModActivation(context: IExtensionContext): Promise<void> {
  const state = context.api.store.getState();
  const activatorId = currentActivator(state);
  const gameMode = activeGameId(state);
  const instPath = installPath(state);
  const gameDiscovery = currentGameDiscovery(state);
  const t = context.api.translate;
  const profile = activeProfile(state);
  const modState = profile !== undefined ? profile.modState : {};

  let activator: IModActivator =
    activatorId !== undefined
        ? activators.find((act: IModActivator) => act.id === activatorId)
        : activators.find((act: IModActivator) => act.isSupported(state) === undefined);

  let mods = state.persistent.mods[gameMode] || {};
  let modList: IMod[] = Object.keys(mods).map((key: string) => mods[key]);

  let notificationId = shortid();
  context.api.sendNotification({
    id: notificationId,
    type: 'activity',
    message: t('Activating mods'),
    title: t('Activating'),
  });

  // test if anything was changed by an external application
  return activator.externalChanges(instPath, gameDiscovery.modPath)
    .then((changes: IFileChange[]) => {
      if (changes.length === 0) {
        return Promise.resolve([]);
      }
      return context.api.store.dispatch(showExternalChanges(changes));
    })
    .then((fileActions: IFileEntry[]) => {
      if (fileActions === undefined) {
        return Promise.resolve();
      }

      let actionGroups: { [type: string]: IFileEntry[] } = {};
      fileActions.forEach((action: IFileEntry) => {
        if (actionGroups[action.action] === undefined) {
          actionGroups[action.action] = [];
        }
        actionGroups[action.action].push(action);
      });

      // tslint:disable:no-string-literal
      // process the actions that the user selected in the dialog
      return Promise.map(actionGroups['drop'] || [],
        // delete the files the user wants to drop
        (entry) => fs.removeAsync(path.join(
          gameDiscovery.modPath, entry.filePath)))
        .then(() => Promise.map(actionGroups['import'] || [],
          // copy the files the user wants to import
          (entry) => fs.copyAsync(
            path.join(gameDiscovery.modPath, entry.filePath),
            path.join(instPath, entry.source, entry.filePath))))
        .then(() => {
          // remove files that the user wants to restore from
          // the activation list because then they get reinstalled
          if (actionGroups['restore'] !== undefined) {
            return activator.forgetFiles(actionGroups['restore'].map((entry) => entry.filePath));
          } else {
            return Promise.resolve();
          }
        })
        .then(() => undefined);
      // tslint:enable:no-string-literal
    })
    // sort mods based on their dependencies so the right files get activated
    .then(() => sortMods(modList, context.api))
    .then((sortedMods: string[]) => {
      let sortedModList =
        modList.sort((lhs: IMod, rhs: IMod) => sortedMods.indexOf(lhs.id) -
          sortedMods.indexOf(rhs.id));

      return activateMods(instPath, gameDiscovery.modPath, sortedModList,
        modState, activator);
    })
    .catch(UserCanceled, () => undefined)
    .catch((err) => { context.api.showErrorNotification('failed to activate mods', err); })
    .finally(() => { context.api.dismissNotification(notificationId); });
}

function init(context: IExtensionContextExt): boolean {
  context.registerMainPage('cubes', 'Mods', ModList, {
    hotkey: 'M',
    visible: () => activeGameId(context.api.store.getState()) !== undefined,
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

  const validActivatorCheck = () => new Promise<ITestResult>((resolve, reject) => {
    const state = context.api.store.getState();
    if (supportedActivators(activators, state).length > 0) {
      return resolve(undefined);
    }

    const messages = activators.map(
      (activator) => `${activator.name} - ${activator.isSupported(state)}`);

    return resolve({
      description: {
        short: 'In the current constellation, mods can\'t be activated.',
        long: messages.join('\n'),
      },
      severity: 'error',
      automaticFix: () => new Promise<void>((fixResolve, fixReject) => {
        context.api.events.emit('show-modal', 'settings');
        context.api.events.on('hide-modal', (modal) => {
          if (modal === 'settings') {
            fixResolve();
          }
        });
      }),
    });
  });

  context.registerTest('valid-activator', 'gamemode-activated', validActivatorCheck);
  context.registerTest('valid-activator', 'settings-changed', validActivatorCheck);

  context.registerSettings('Mods', Settings, () => ({activators}));

  context.registerDialog('external-changes', ExternalChangeDialog);

  context.registerReducer(['session', 'externalChanges'], externalChangesReducer);
  context.registerReducer(['settings', 'mods'], settingsReducer);
  context.registerReducer(['persistent', 'mods'], modsReducer);

  context.registerModActivator = registerModActivator;
  context.registerInstaller = registerInstaller;

  registerInstaller(1000, basicInstaller.testSupported, basicInstaller.install);

  context.once(() => {
    const store: Redux.Store<any> = context.api.store;

    if (installManager === undefined) {
      installManager = new InstallManager(() => installPath(store.getState()));
      installers.forEach((installer: IInstaller) => {
        installManager.addInstaller(installer.priority, installer.testSupported, installer.install);
      });
    }

    context.api.events.on('activate-mods', (callback: (err: Error) => void) => {
      updateModActivation(context)
      .then(() => callback(null))
      .catch((err) => callback(err));
    });

    context.api.events.on('mods-enabled', (mods: string[], enabled: boolean) => {
      if (store.getState().settings.automation.deploy) {
        updateModActivation(context);
      }
    });

    context.api.events.on('gamemode-activated', (newGame: string) => {
      let configuredActivator = currentActivator(store.getState());
      let supported = supportedActivators(activators, store.getState());
      if (supported.find((activator: IModActivator) =>
        activator.id === configuredActivator) === undefined) {
        // current activator is not valid for this game. This should only occur
        // if compatibility of the activator has changed
        if (supported.length > 0) {
          context.api.store.dispatch(setActivator(supported[0].id));
        }
      }

      let knownMods = Object.keys(getSafe(store.getState(), ['persistent', 'mods', newGame], {}));
      refreshMods(installPath(store.getState()), knownMods, (mod: IMod) => {
        context.api.store.dispatch(addMod(newGame, mod));
      }, (modNames: string[]) => {
        modNames.forEach((name: string) => {
          context.api.store.dispatch(removeMod(newGame, name));
        });
      })
        .then(() => {
          context.api.events.emit('mods-refreshed');
        });
    });

    context.api.onStateChange(
      ['settings', 'mods', 'paths'],
      (previous: { [gameId: string]: IStatePaths }, current: { [gameId: string]: IStatePaths }) => {
        const gameMode = activeGameId(store.getState());
        if (previous[gameMode] !== current[gameMode]) {
          let knownMods = Object.keys(store.getState().persistent.mods[gameMode]);
          refreshMods(installPath(store.getState()), knownMods, (mod: IMod) => {
            context.api.store.dispatch(addMod(gameMode, mod));
          }, (modNames: string[]) => {
            modNames.forEach((name: string) => {
              context.api.store.dispatch(removeMod(gameMode, name)); });
          });
        }
      });

    context.api.events.on(
        'start-install',
        (archivePath: string, callback?: (error, id: string) => void) => {
          installManager.install(null, archivePath,
                                 activeGameId(store.getState()), context.api,
                                 {}, true, callback);
        });

    context.api.events.on(
        'start-install-download',
        (downloadId: string, callback?: (error, id: string) => void) => {
          let download: IDownload =
              store.getState().persistent.downloads.files[downloadId];
          let fullPath: string = path.join(downloadPath(store.getState()), download.localPath);
          installManager.install(downloadId, fullPath, download.game, context.api,
                                 download.modInfo, true, callback);
        });

    context.api.events.on(
        'remove-mod', (modId: string, callback?: (error: Error) => void) => {
          let mods: {[id: string]: IMod};
          let fullPath: string;
          const gameMode = activeGameId(store.getState());
          try {
            mods = store.getState().persistent.mods[gameMode];
            fullPath = path.join(installPath(store.getState()),
                                 mods[modId].installationPath);
          } catch (err) {
            callback(err);
          }
          fs.removeAsync(fullPath)
              .then(() => {
                store.dispatch(removeMod(gameMode, modId));
                callback(null);
              })
              .catch((err) => { callback(err); });
        });
  });

  return true;
}

export default init;
