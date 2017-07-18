import {showDialog} from '../../actions/notifications';
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
import {IDiscoveryResult} from '../gamemode_management/types/IDiscoveryResult';
import {setModEnabled} from '../profile_management/actions/profiles';
import {IProfileMod} from '../profile_management/types/IProfile';

import {showExternalChanges} from './actions/externalChanges';
import {addMod, removeMod, setModAttribute} from './actions/mods';
import {setActivator} from './actions/settings';
import {externalChangesReducer} from './reducers/externalChanges';
import {modsReducer} from './reducers/mods';
import {settingsReducer} from './reducers/settings';
import {IFileEntry} from './types/IFileEntry';
import {IInstall} from './types/IInstall';
import {IMod} from './types/IMod';
import {
  IDeployedFile,
  IFileChange,
  IModActivator,
} from './types/IModActivator';
import {IModSource} from './types/IModSource';
import {ITestSupported} from './types/ITestSupported';
import * as basicInstaller from './util/basicInstaller';
import { registerAttributeExtractor } from './util/filterModInfo';
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
import getText from './texts';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as Redux from 'redux';
import { generate as shortid } from 'shortid';

const activators: IModActivator[] = [];

let installManager: InstallManager;

interface IInstaller {
  priority: number;
  testSupported: ITestSupported;
  install: IInstall;
}

const installers: IInstaller[] = [];

const modSources: IModSource[] = [];

export interface IExtensionContextExt extends IExtensionContext {
  registerModActivator: (activator: IModActivator) => void;
  registerInstaller: (priority: number, testSupported: ITestSupported, install: IInstall) => void;
}

function registerModActivator(activator: IModActivator) {
  activators.push(activator);
}

function registerInstaller(priority: number, testSupported: ITestSupported, install: IInstall) {
  installers.push({ priority, testSupported, install });
}

function registerModSource(id: string, name: string, onBrowse: () => void) {
  modSources.push({ id, name, onBrowse });
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

  return loadActivation(api, gameDiscovery.modPath)
      .then(() => activator.purge(instPath, gameDiscovery.modPath))
      .then(() => saveActivation(state.app.instanceId, gameDiscovery.modPath, []))
      .catch(UserCanceled, () => undefined)
      .catch(err => api.showErrorNotification('failed to purge mods', err))
      .finally(() => api.dismissNotification(notificationId));
}

function fallbackPurge(basePath: string,
                       files: IDeployedFile[]): Promise<void> {
  return Promise.map(files, file => {
    const fullPath = path.join(basePath, file.relPath);
    return fs.statAsync(fullPath).then(stats => {
      if (stats.mtime.getTime() === file.time) {
        return fs.unlinkAsync(fullPath);
      } else {
        return Promise.resolve();
      }
    })
    .catch(err => {
      if (err.code !== 'ENOENT') {
        return Promise.reject(err);
      } // otherwise ignore
    });
  })
  .then(() => undefined);
}

function queryPurge(api: IExtensionApi, basePath: string,
                    files: IDeployedFile[]): Promise<void> {
  const t = api.translate;
  return api.store.dispatch(showDialog('info', t('Purge files from different instance?'), {
    message: t('IMPORTANT: This game was modded by another instance of Vortex.\n\n' +
               'If you switch between different instances (or between shared and ' +
               'single-user mode) it\'s better if you purge mods before switching.\n\n' +
               'Vortex can try to clean up now but this is less reliable (*) than doing it ' +
               'from the instance that deployed the files in the first place.\n\n' +
               'If you modified any files in the game directory you should back them up ' +
               'before continuing.\n\n' +
               '(*) This purge relies on a manifest of deployed files, created by that other ' +
               'instance. Files that have been changed since that manifest was created ' +
               'won\'t be removed to prevent data loss. If the manifest is damaged or ' +
               'outdated the purge may be incomplete. When purging from the "right" instance ' +
               'the manifest isn\'t required, it can reliably deduce which files need to ' +
               'be removed.'),
  }, {
    Cancel: null,
    Purge: null,
  }))
  .then(result => {
    if (result.action === 'Purge') {
      return fallbackPurge(basePath, files);
    } else {
      return Promise.reject(new UserCanceled());
    }
  });
}

function loadActivation(api: IExtensionApi, gamePath: string): Promise<IDeployedFile[]> {
  const tagFile = path.join(gamePath, 'vortex.deployment.json');
  return fs.readFileAsync(tagFile).then(tagData => {
    const state = api.store.getState();
    const tagObject = JSON.parse(tagData.toString());
    if (tagObject.instance !== state.app.instanceId) {
      return queryPurge(api, gamePath, tagObject.files)
          .then(() => saveActivation(state.app.instanceId, gamePath, []))
          .then(() => Promise.resolve([]));
    } else {
      return Promise.resolve(tagObject.files);
    }
  })
  .catch(() => []);
}

function saveActivation(instance: string, gamePath: string, activation: IDeployedFile[]) {
  const tagFile = path.join(gamePath, 'vortex.deployment.json');

  return fs.writeFileAsync(tagFile, JSON.stringify(
                                        {
                                          instance,
                                          files: activation,
                                        },
                                        undefined, 2));
}

function genUpdateModActivation() {
  let lastActivatedState: {[modId: string]: IProfileMod};
  let lastGameDiscovery: IDiscoveryResult;

  return (api: IExtensionApi, manual: boolean): Promise<void> => {
    const state = api.store.getState();
    const gameMode = activeGameId(state);
    const instPath = installPath(state);
    const gameDiscovery = currentGameDiscovery(state);
    const t = api.translate;
    let profile = activeProfile(state);
    let modState = profile !== undefined ? profile.modState : {};
    const activator = getActivator(state);

    if (activator === undefined) {
      // this situation (no supported activator) should already be reported
      // elsewhere
      return Promise.resolve();
    }

    if ((modState === lastActivatedState) &&
        (gameDiscovery === lastGameDiscovery)) {
      // early out if nothing relevant to the deployment has changed
      return Promise.resolve();
    }

    lastGameDiscovery = gameDiscovery;

    const mods = state.persistent.mods[gameMode] || {};
    const modList: IMod[] = Object.keys(mods).map((key: string) => mods[key]);

    let notificationId: string;

    const gate = manual ? Promise.resolve() : activator.userGate();

    let lastActivation: IDeployedFile[] = [];

    // test if anything was changed by an external application
    return gate.then(() => {
                 // update mod state again because if the user did have to
                 // confirm, it's more intuitive
                 // if we deploy the state at the time he confirmed, not when
                 // the deployment was triggered
                 profile = activeProfile(api.store.getState());
                 lastActivatedState = modState =
                     profile !== undefined ? profile.modState : {};
                 notificationId = api.sendNotification({
                   type: 'activity',
                   message: t('Deploying mods'),
                   title: t('Deploying'),
                 });

                 return loadActivation(api, gameDiscovery.modPath);
               })
        .then(currentActivation => {
          lastActivation = currentActivation;
          return activator.externalChanges(instPath, gameDiscovery.modPath, currentActivation);
        })
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
          const sortedModList = modList.sort((lhs: IMod, rhs: IMod) =>
                                                 sortedMods.indexOf(lhs.id) -
                                                 sortedMods.indexOf(rhs.id));

          return activateMods(instPath, gameDiscovery.modPath, sortedModList,
                              modState, activator, lastActivation)
              .then(newActivation =>
                        saveActivation(state.app.instanceId,
                                       gameDiscovery.modPath, newActivation))
              .then(() => new Promise((resolve, reject) => {
                      api.events.emit('bake-settings', gameMode, sortedModList,
                                      err => {
                                        if (err !== null) {
                                          reject(err);
                                        } else {
                                          resolve();
                                        }
                                      });
                    }));
        })
        .catch(UserCanceled, () => undefined)
        .catch(err => api.showErrorNotification('failed to deploy mods', err))
        .finally(() => api.dismissNotification(notificationId));
  };
}

function init(context: IExtensionContextExt): boolean {
  const modsActivity = new ReduxProp(context.api, [
    ['session', 'base', 'activity', 'mods'],
  ], (activity: string[]) => (activity !== undefined) && (activity.length > 0));

  context.registerMainPage('wrench', 'Mods',
    LazyComponent('./views/ModList', __dirname), {
    hotkey: 'M',
    group: 'per-game',
    visible: () => activeGameId(context.api.store.getState()) !== undefined,
    activity: modsActivity,
    props: () => ({ modSources }),
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

  context.registerTableAttribute('mods', {
    id: 'mod-source',
    name: 'Source',
    help: getText('source', context.api.translate),
    description: 'Source the mod was downloaded from',
    icon: 'database',
    placement: 'detail',
    calc: (mod: IMod) => {
      const source = modSources.find(iter => iter.id === mod.attributes['source']);
      return source !== undefined ? source.name : 'None';
    },
    edit: {
      choices: () => modSources.map(source => ({ key: source.id, text: source.name })),
      onChangeValue: (rowId: string, newValue: string) => {
        const store = context.api.store;
        const gameMode = activeGameId(store.getState());
        store.dispatch(setModAttribute(gameMode, rowId, 'source', newValue));
      },
    },
  });

  context.registerModActivator = registerModActivator;
  context.registerInstaller = registerInstaller;
  context.registerAttributeExtractor = registerAttributeExtractor;
  context.registerModSource = registerModSource;

  registerAttributeExtractor(100, (input: any) => {
    return Promise.resolve({
        source: getSafe(input, ['source'], undefined),
        fileName: getSafe(input.meta, ['fileName'], undefined),
        fileMD5: getSafe(input.meta, ['fileMD5'], undefined),
        fileSize: getSafe(input.meta, ['fileSize'], undefined),
        version: getSafe(input.meta, ['fileVersion'], undefined),
        logicalFileName: getSafe(input.meta, ['logicalFileName'], undefined),
        rules: getSafe(input.meta, ['rules'], undefined),
        category: getSafe(input.meta, ['details', 'category'], undefined),
        description: getSafe(input.meta, ['details', 'description'], undefined),
        author: getSafe(input.meta, ['details', 'author'], undefined),
        homepage: getSafe(input.meta, ['details', 'homepage'], undefined),
      });
  });

  registerInstaller(1000, basicInstaller.testSupported, basicInstaller.install);

  context.once(() => {
    const store: Redux.Store<any> = context.api.store;

    if (installManager === undefined) {
      installManager = new InstallManager(() => installPath(store.getState()));
      installers.forEach((installer: IInstaller) => {
        installManager.addInstaller(installer.priority, installer.testSupported, installer.install);
      });
    }

    const updateModActivation = genUpdateModActivation();
    const activationTimer = new Debouncer((manual: boolean) => {
      return updateModActivation(context.api, manual);
    }, 2000);

    context.api.events.on('activate-mods', (callback: (err: Error) => void) => {
      activationTimer.runNow(callback, true);
    });

    context.api.events.on('schedule-activate-mods', (callback: (err: Error) => void) => {
      activationTimer.schedule(callback, false);
    });

    context.api.events.on('purge-mods', (callback: (err: Error) => void) => {
      purgeMods(context.api);
    });

    context.api.events.on('await-activation', (callback: (err: Error) => void) => {
      activationTimer.wait(callback);
    });

    context.api.events.on('mods-enabled', (mods: string[], enabled: boolean) => {
      if (store.getState().settings.automation.deploy) {
        activationTimer.schedule(undefined, false);
      }
    });

    context.api.events.on('gamemode-activated', (newGame: string) => {
      const state = store.getState();
      const configuredActivatorId = currentActivator(state);
      const supported = supportedActivators(activators, state);
      const configuredActivator =
        supported.find(activator => activator.id === configuredActivatorId);
      const gameDiscovery = currentGameDiscovery(state);

      const instPath = installPath(state);

      if (configuredActivator === undefined) {
        // current activator is not valid for this game. This should only occur
        // if compatibility of the activator has changed

        const oldActivator = activators.find(iter => iter.id === configuredActivatorId);

        if ((configuredActivatorId !== undefined) && (oldActivator === undefined)) {
          context.api.showErrorNotification(
              'Deployment method "' + configuredActivatorId + '" no longer available',
              'The deployment method used with this game is no longer available. ' +
              'This probably means you removed the corresponding extension or ' +
              'it can no longer be loaded due to a bug.\n' +
              'Vortex can\'t clean up files deployed with an unsupported method. ' +
              'You should try to restore it, purge deployment and then switch ' +
              'to a different method.');
        } else {
          const purgePromise = oldActivator !== undefined
            ? oldActivator.purge(instPath, gameDiscovery.modPath)
            : Promise.resolve();

          purgePromise.then(() => {
                if (supported.length > 0) {
                  context.api.store.dispatch(
                      setActivator(newGame, supported[0].id));
                }
              });
        }
      }

      const knownMods = Object.keys(getSafe(state, ['persistent', 'mods', newGame], {}));
      refreshMods(instPath, knownMods, (mod: IMod) => {
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
        const state = store.getState();
        const gameMode = activeGameId(state);
        if (previous[gameMode] !== current[gameMode]) {
          const knownMods = Object.keys(state.persistent.mods[gameMode]);
          refreshMods(installPath(state), knownMods, (mod: IMod) => {
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
          loadActivation(context.api, dataPath)
            .then(lastActivation => activator.prepare(
              dataPath, false, lastActivation))
            .then(() =>
              activator.deactivate(installPath(state), dataPath, mod))
            .then(() => activator.finalize(dataPath))
            .then(newActivation => saveActivation(state.app.instanceId, dataPath, newActivation))
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
