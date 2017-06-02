import {IExtensionApi, IExtensionContext} from '../../types/IExtensionContext';
import {IState, IStatePaths} from '../../types/IState';
import {ITableAttribute} from '../../types/ITableAttribute';
import {ITestResult} from '../../types/ITestResult';
import { UserCanceled } from '../../util/CustomErrors';
import Debouncer from '../../util/Debouncer';
import LazyComponent from '../../util/LazyComponent';
import { showError } from '../../util/message';
import ReduxProp from '../../util/ReduxProp';
import {
  activeGameId,
  activeProfile,
  currentActivator,
  currentGameDiscovery,
  installPath,
} from '../../util/selectors';
import {getSafe} from '../../util/storeHelper';

import {IDownload} from '../download_management/types/IDownload';
import {setModEnabled} from '../profile_management/actions/profiles';

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
import {ITestSupported} from './types/ITestSupported';
import * as basicInstaller from './util/basicInstaller';
import refreshMods from './util/refreshMods';
import resolvePath from './util/resolvePath';
import sortMods from './util/sort';
import supportedActivators from './util/supportedActivators';
import ActivationButton from './views/ActivationButton';
import DeactivationButton from './views/DeactivationButton';
import {} from './views/ExternalChangeDialog';
import {} from './views/ModList';
import {} from './views/Settings';

import InstallManager from './InstallManager';
import { activateMods } from './modActivation';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import { generate as shortid } from 'shortid';

const activators: IModActivator[] = [];

let installManager: InstallManager;

interface IInstaller {
  priority: number;
  testSupported: ITestSupported;
  install: IInstall;
}

const installers: IInstaller[] = [];

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

function getActivator(state: IState): IModActivator {
  const activatorId = currentActivator(state);
  let activator: IModActivator;
  if (activatorId !== undefined) {
    activator = activators.find((act: IModActivator) => act.id === activatorId);
  }
  if (activator === undefined) {
    activator = activators.find((act: IModActivator) => act.isSupported(state) === undefined);
  }
  return activator;
}

function purgeMods(api: IExtensionApi): Promise<void> {
  const state = api.store.getState();
  const instPath = installPath(state);
  const gameDiscovery = currentGameDiscovery(state);
  const t = api.translate;
  const activator = getActivator(state);

  const notificationId = api.sendNotification({
    type: 'activity',
    message: t('Purging mods'),
    title: t('Purging'),
  });

  return activator.purge(instPath, gameDiscovery.modPath)
      .catch(UserCanceled, () => undefined)
      .catch(err => api.showErrorNotification('failed to purge mods', err))
      .finally(() => api.dismissNotification(notificationId));
}

function updateModActivation(api: IExtensionApi): Promise<void> {
  const state = api.store.getState();
  const gameMode = activeGameId(state);
  const instPath = installPath(state);
  const gameDiscovery = currentGameDiscovery(state);
  const t = api.translate;
  const profile = activeProfile(state);
  const modState = profile !== undefined ? profile.modState : {};
  const activator = getActivator(state);

  if (activator === undefined) {
    // this situation (no supported activator) should already be reported elsewhere
    return Promise.resolve();
  }

  const mods = state.persistent.mods[gameMode] || {};
  const modList: IMod[] = Object.keys(mods).map((key: string) => mods[key]);

  const notificationId = api.sendNotification({
    type: 'activity',
    message: t('Deploying mods'),
    title: t('Deploying'),
  });

  // test if anything was changed by an external application
  return activator.externalChanges(instPath, gameDiscovery.modPath)
      .then((changes: IFileChange[]) =>
                (changes.length === 0) ?
                    Promise.resolve([]) :
                    api.store.dispatch(showExternalChanges(changes)))
      .then((fileActions: IFileEntry[]) => {
        if (fileActions === undefined) {
          return Promise.resolve();
        }

        const actionGroups: {[type: string]: IFileEntry[]} = {};
        fileActions.forEach((action: IFileEntry) => {
          if (actionGroups[action.action] === undefined) {
            actionGroups[action.action] = [];
          }
          actionGroups[action.action].push(action);
        });

        // process the actions that the user selected in the dialog
        return Promise.map(actionGroups['drop'] || [],
                           // delete the files the user wants to drop
                           (entry) => fs.removeAsync(path.join(
                               gameDiscovery.modPath, entry.filePath)))
            .then(() => Promise.map(
                      actionGroups['import'] || [],
                      // copy the files the user wants to import
                      (entry) => fs.copyAsync(
                          path.join(gameDiscovery.modPath, entry.filePath),
                          path.join(instPath, entry.source, entry.filePath))))
            .then(() => {
              // remove files that the user wants to restore from
              // the activation list because then they get reinstalled
              if (actionGroups['restore'] !== undefined) {
                return activator.forgetFiles(
                    actionGroups['restore'].map((entry) => entry.filePath));
              } else {
                return Promise.resolve();
              }
            })
            .then(() => undefined);
      })
      // sort (all) mods based on their dependencies so the right files get
      // activated
      .then(() => sortMods(gameMode, modList, api))
      .then((sortedMods: string[]) => {
        const sortedModList =
            modList.sort((lhs: IMod, rhs: IMod) => sortedMods.indexOf(lhs.id) -
                                                   sortedMods.indexOf(rhs.id));

        return activateMods(instPath, gameDiscovery.modPath, sortedModList,
                            modState, activator);
      })
      .catch(UserCanceled, () => undefined)
      .catch(err => api.showErrorNotification('failed to deploy mods', err))
      .finally(() => api.dismissNotification(notificationId));
}

function init(context: IExtensionContextExt): boolean {
  const modsActivity = new ReduxProp(context.api, [
    ['session', 'base', 'activity', 'mods'],
  ], (activity: string[]) => (activity !== undefined) && (activity.length > 0));

  context.registerMainPage('cubes', 'Mods',
    LazyComponent('./views/ModList', __dirname), {
    hotkey: 'M',
    group: 'per-game',
    visible: () => activeGameId(context.api.store.getState()) !== undefined,
    activity: modsActivity,
  });

  context.registerAction('mod-icons', 105, ActivationButton, () => {
    return {
      key: 'activate-button',
      activators,
    };
  });

  context.registerAction('mod-icons', 110, DeactivationButton, () => {
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

  context.registerSettings('Mods', LazyComponent('./views/Settings', __dirname),
                           () => ({activators}));

  context.registerDialog('external-changes',
                         LazyComponent('./views/ExternalChangeDialog', __dirname));

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

    const activationTimer = new Debouncer(() => {
      return updateModActivation(context.api);
    }, 2000);

    context.api.events.on('activate-mods', (callback: (err: Error) => void) => {
      activationTimer.runNow(callback);
    });

    context.api.events.on('schedule-activate-mods', (callback: (err: Error) => void) => {
      activationTimer.schedule(callback);
    });

    context.api.events.on('purge-mods', (callback: (err: Error) => void) => {
      purgeMods(context.api);
    });

    context.api.events.on('await-activation', (callback: (err: Error) => void) => {
      activationTimer.wait(callback);
    });

    context.api.events.on('mods-enabled', (mods: string[], enabled: boolean) => {
      if (store.getState().settings.automation.deploy) {
        activationTimer.schedule(undefined);
      }
    });

    context.api.events.on('gamemode-activated', (newGame: string) => {
      const configuredActivator = currentActivator(store.getState());
      const supported = supportedActivators(activators, store.getState());
      if (supported.find((activator: IModActivator) =>
        activator.id === configuredActivator) === undefined) {
        // current activator is not valid for this game. This should only occur
        // if compatibility of the activator has changed
        if (supported.length > 0) {
          context.api.store.dispatch(setActivator(newGame, supported[0].id));
        }
      }

      const knownMods = Object.keys(getSafe(store.getState(), ['persistent', 'mods', newGame], {}));
      refreshMods(installPath(store.getState()), knownMods, (mod: IMod) => {
        context.api.store.dispatch(addMod(newGame, mod));
      }, (modNames: string[]) => {
        modNames.forEach((name: string) => {
          context.api.store.dispatch(removeMod(newGame, name));
        });
      })
        .then(() => {
          context.api.events.emit('mods-refreshed');
        })
         .catch((err: Error) => {
            showError(store.dispatch, 'Failed to refresh mods', err);
          });
    });

    context.api.onStateChange(
      ['settings', 'mods', 'paths'],
      (previous: { [gameId: string]: IStatePaths }, current: { [gameId: string]: IStatePaths }) => {
        const gameMode = activeGameId(store.getState());
        if (previous[gameMode] !== current[gameMode]) {
          const knownMods = Object.keys(store.getState().persistent.mods[gameMode]);
          refreshMods(installPath(store.getState()), knownMods, (mod: IMod) => {
            context.api.store.dispatch(addMod(gameMode, mod));
          }, (modNames: string[]) => {
            modNames.forEach((name: string) => {
              context.api.store.dispatch(removeMod(gameMode, name)); });
          })
          .catch((err: Error) => {
            showError(store.dispatch, 'Failed to refresh mods', err);
          });
        }
      });

    context.api.events.on(
        'start-install',
        (archivePath: string, callback?: (error, id: string) => void) => {
          installManager.install(null, archivePath,
                                 activeGameId(store.getState()), context.api,
                                 {}, true, false, callback);
        });

    context.api.events.on(
        'start-install-download',
        (downloadId: string, callback?: (error, id: string) => void) => {
          const state = store.getState();
          const download: IDownload = state.persistent.downloads.files[downloadId];
          const inPaths = state.settings.mods.paths;
          const downloadPath: string = resolvePath('download', inPaths, download.game);
          const fullPath: string = path.join(downloadPath, download.localPath);
          installManager.install(downloadId, fullPath, download.game, context.api,
                                 download.modInfo, true, false, callback);
        });

    context.api.events.on(
        'remove-mod', (gameMode: string, modId: string, callback?: (error: Error) => void) => {
          const state = store.getState();
          let mod: IMod;
          let fullPath: string;
          try {
            const mods = state.persistent.mods[gameMode];
            mod = mods[modId];
            fullPath = path.join(installPath(state), mod.installationPath);
          } catch (err) {
            callback(err);
          }

          // we need to remove the mod from activation, otherwise me might leave orphaned
          // links in the mod directory
          const currentProfile = activeProfile(state);
          store.dispatch(setModEnabled(currentProfile.id, modId, false));

          const activatorId = currentActivator(state);
          const activator: IModActivator =
              activatorId !== undefined ?
                  activators.find((act: IModActivator) =>
                                      act.id === activatorId) :
                  activators.find((act: IModActivator) =>
                                      act.isSupported(state) === undefined);

          const dataPath = currentGameDiscovery(state).modPath;
          activator.prepare(dataPath, false)
              .then(() => activator.deactivate(installPath(state), dataPath, mod))
              .then(() => activator.finalize(dataPath))
              .then(() => fs.removeAsync(fullPath))
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
