import { setPluginEnabled, setPluginOrder, updateLoadOrder } from './actions/loadOrder';
import { setPluginList } from './actions/plugins';
import { loadOrderReducer } from './reducers/loadOrder';
import { pluginsReducer } from './reducers/plugins';
import { settingsReducer } from './reducers/settings';
import userlistReducer from './reducers/userlist';
import userlistEditReducer from './reducers/userlistEdit';
import { ILoadOrder } from './types/ILoadOrder';
import { IPlugins } from './types/IPlugins';
import Connector from './views/Connector';
import PluginList from './views/PluginList';
import UserlistEditor from './views/UserlistEditor';

import LootInterface from './autosort';

import {
  gameSupported,
  isNativePlugin,
  nativePlugins,
  pluginPath,
  supportedGames,
} from './util/gameSupport';
import PluginPersistor from './util/PluginPersistor';
import UserlistPersistor from './util/UserlistPersistor';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import ESPFile from 'esptk';
import { access, constants } from 'fs';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as nodeUtil from 'util';
import { actions, log, selectors, types, util } from 'vortex-api';

interface IModState {
  enabled: boolean;
}

interface IModStates {
  [modId: string]: IModState;
}

function isPlugin(fileName: string): boolean {
  return ['.esp', '.esm', '.esl'].indexOf(path.extname(fileName).toLowerCase()) !== -1;
}

/**
 * updates the list of known plugins for the managed game
 */
function updatePluginList(store: Redux.Store<any>, newModList: IModStates): Promise<void> {
  if (newModList === undefined) {
    return;
  }

  const state = store.getState();

  const gameMode = selectors.activeGameId(state);
  const pluginSources: { [pluginName: string]: string } = {};

  const currentDiscovery = selectors.currentGameDiscovery(state);
  const readErrors = [];

  const gameMods = state.persistent.mods[gameMode] || {};

  const enabledModIds = Object.keys(gameMods).filter(
      modId => util.getSafe(newModList, [modId, 'enabled'], false));

  return Promise.map(enabledModIds,
           (modId: string) => {
             const mod = gameMods[modId];
             return fs.readdirAsync(path.join(selectors.installPath(state),
                                              mod.installationPath))
                 .then((fileNames: string[]) => {
                   fileNames.filter((fileName: string) =>
                                        ['.esp', '.esm', '.esl'].indexOf(
                                            path.extname(fileName)) !== -1)
                       .forEach((fileName: string) => {
                         pluginSources[fileName] = mod.name || mod.id;
                       });
                 })
                 .catch((err: Error) => {
                   readErrors.push(mod.id);
                   log('warn', 'failed to read mod directory',
                       {path: mod.installationPath, error: err.message});
                 });
           })
      .then(() => {
        if (readErrors.length > 0) {
          util.showError(
              store.dispatch, 'Failed to read some mods',
              'The following mods could not be searched (see log for details):\n' +
                  readErrors.join('\n') + '\n' + (new Error()).stack);
        }
        if (currentDiscovery === undefined) {
          return Promise.resolve([]);
        }
        const modPath = currentDiscovery.modPath;
        // if reading the mod directory fails that's probably a broken installation,
        // but it's not the responsible of this extension to report that, the
        // game mode management will notice this as well.
        return fs.readdirAsync(modPath).catch(err => []);
      })
      .then((fileNames: string[]) => {
        const pluginNames: string[] = fileNames.filter(isPlugin);
        const pluginStates: IPlugins = {};
        pluginNames.forEach((fileName: string) => {
          const modName = pluginSources[fileName];
          pluginStates[fileName] = {
            modName: modName || '',
            filePath: path.join(currentDiscovery.modPath, fileName),
            isNative:
                modName === undefined && isNativePlugin(gameMode, fileName),
          };
        });
        store.dispatch(setPluginList(pluginStates));
        store.dispatch(updateLoadOrder(pluginNames));
        return Promise.resolve();
      })
      .catch((err: Error) => {
        util.showError(store.dispatch, 'Failed to update plugin list', err);
      });
}

interface IExtensionContextExt extends types.IExtensionContext {
  registerProfileFile: (gameId: string, filePath: string) => void;
}

let pluginPersistor: PluginPersistor;
let userlistPersistor: UserlistPersistor;
let masterlistPersistor: UserlistPersistor;
let loot: LootInterface;
let refreshTimer: NodeJS.Timer;

function register(context: IExtensionContextExt) {
  const lootActivity = new util.ReduxProp(context.api, [
    ['session', 'plugins', 'lootActivity'],
  ], (activity: string) => (activity !== undefined) && (activity !== ''));
  context.registerMainPage('puzzle', 'Plugins', PluginList, {
    hotkey: 'E',
    group: 'per-game',
    visible: () => gameSupported(selectors.activeGameId(context.api.store.getState())),
    props: () => ({
      nativePlugins: gameSupported(selectors.activeGameId(context.api.store.getState()))
        ? nativePlugins(selectors.activeGameId(context.api.store.getState()))
        : [],
    }),
    activity: lootActivity,
  });

  for (const game of supportedGames()) {
    context.registerProfileFile(game, path.join(pluginPath(game), 'plugins.txt'));
    context.registerProfileFile(game, path.join(pluginPath(game), 'loadorder.txt'));
  }

  context.registerReducer(['session', 'plugins'], pluginsReducer);
  context.registerReducer(['loadOrder'], loadOrderReducer);
  context.registerReducer(['userlist'], userlistReducer);
  context.registerReducer(['masterlist'], { defaults: {}, reducers: {} });
  context.registerReducer(['settings', 'plugins'], settingsReducer);
  context.registerReducer(['session', 'pluginDependencies'], userlistEditReducer);

  context.registerTest('plugins-locked', 'gamemode-activated',
    () => testPluginsLocked(selectors.activeGameId(context.api.store.getState())));
  context.registerTest('master-missing', 'plugins-changed',
    () => testMissingMasters(context.api.translate, context.api.store.getState()));
  context.registerDialog('plugin-dependencies-connector', Connector);
  context.registerDialog('userlist-editor', UserlistEditor);
}

/**
 * initialize persistor, exposing the content of plugins.txt / loadorder.txt to
 * the store
 */
function initPersistor(context: IExtensionContextExt) {
  const onError = (message: string, detail: Error) => {
    context.api.showErrorNotification(message, detail);
  };
  // TODO: Currently need to stop this from being called in the main process.
  //   This is mega-ugly and needs to go
  if (remote !== undefined) {
    if (pluginPersistor === undefined) {
      pluginPersistor = new PluginPersistor(onError);
    }
    if (userlistPersistor === undefined) {
      userlistPersistor = new UserlistPersistor('userlist', onError);
    }
    if (masterlistPersistor === undefined) {
      masterlistPersistor = new UserlistPersistor('masterlist', onError);
    }
  }
  if (pluginPersistor !== undefined) {
    context.registerPersistor('loadOrder', pluginPersistor);
  }
  if (userlistPersistor !== undefined) {
    context.registerPersistor('userlist', userlistPersistor);
  }
  if (masterlistPersistor !== undefined) {
    context.registerPersistor('masterlist', masterlistPersistor);
  }
}

/**
 * update the plugin list for the currently active profile
 */
function updateCurrentProfile(store: Redux.Store<any>): Promise<void> {
  const gameId = selectors.activeGameId(store.getState());

  if (!gameSupported(gameId)) {
    return;
  }

  const profile = selectors.activeProfile(store.getState());
  if (profile === undefined) {
    log('warn', 'no profile active');
    return;
  }

  return updatePluginList(store, profile.modState);
}

let watcher: fs.FSWatcher;

function stopSync(): Promise<void> {
  if (watcher !== undefined) {
    watcher.close();
    watcher = undefined;
  }

  return pluginPersistor.disable();
}

function startSync(api: types.IExtensionApi): Promise<void> {
  const store = api.store;

  const gameId = selectors.activeGameId(store.getState());

  let prom: Promise<void> = Promise.resolve();

  if (pluginPersistor !== undefined) {
    prom = pluginPersistor.loadFiles(gameId);
  }

  if (userlistPersistor !== undefined) {
    prom = prom.then(() => userlistPersistor.loadFiles(gameId));
  }

  if (masterlistPersistor !== undefined) {
    prom = prom.then(() => masterlistPersistor.loadFiles(gameId));
  }

  return prom.then(() => {
    const gameDiscovery = selectors.currentGameDiscovery(store.getState());
    if (gameDiscovery === undefined) {
      return;
    }
    const modPath = gameDiscovery.modPath;
    if (modPath === undefined) {
      // can this even happen?
      log('error', 'mod path unknown', {
        discovery:
            nodeUtil.inspect(selectors.currentGameDiscovery(store.getState())),
      });
      return;
    }
    // watch the mod directory. if files change, that may mean our plugin list
    // changed, so refresh
    try {
      watcher = fs.watch(modPath, {}, (evt: string, fileName: string) => {
        if (refreshTimer !== undefined) {
          clearTimeout(refreshTimer);
        }
        refreshTimer = setTimeout(() => {
          updateCurrentProfile(store)
              .then(() => api.events.emit('autosort-plugins'));
          refreshTimer = undefined;
        }, 500);
      });
    } catch (err) {
      api.showErrorNotification('failed to watch mod directory', err,
        { allowReport: err.code !== 'ENOENT' });
    }
  });
}

function testPluginsLocked(gameMode: string): Promise<types.ITestResult> {
  if (!gameSupported(gameMode)) {
    return Promise.resolve(undefined);
  }

  const filePath = path.join(pluginPath(gameMode), 'plugins.txt');
  return new Promise<types.ITestResult>((resolve, reject) => {
    access(filePath, constants.W_OK, (err) => {
      if (err && (err.code === 'EPERM')) {
        const res: types.ITestResult = {
          description: {
            short: 'plugins.txt is write protected',
            long: 'This file is used to control which plugins the game uses and while it\'s '
            + 'write protected Vortex will not be able to enable or disable plugins.\n'
            + 'If you click "fix" the file will be marked writable.',
          },
          severity: 'error',
          automaticFix: () =>
            fs.chmodAsync(filePath, parseInt('0777', 8)),
        };

        resolve(res);
      } else {
        resolve();
      }
    });
  });
}

function testMissingMasters(t: I18next.TranslationFunction,
                            state: any): Promise<types.ITestResult> {
  const gameMode = selectors.activeGameId(state);
  if (!gameSupported(gameMode)) {
    return Promise.resolve(undefined);
  }

  const pluginList = state.session.plugins.pluginList;

  const loadOrder: { [plugin: string]: ILoadOrder } = state.loadOrder;
  const enabledPlugins = Object.keys(loadOrder).filter(
    (plugin: string) => loadOrder[plugin].enabled);
  const pluginDetails =
    enabledPlugins.filter((name: string) => pluginList[name] !== undefined)
      .map((plugin) => {
        try {
          return {
            name: plugin,
            masterList: new ESPFile(pluginList[plugin].filePath).masterList,
          };
        } catch (err) {
          log('warn', 'failed to parse esp file', { name, err: err.message });
          return { name: plugin, masterList: [] };
        }
      });
  // previously this only contained plugins that were marked as masters but apparenly
  // some plugins reference non-masters as their dependency.
  const masters = new Set<string>([].concat(
    pluginDetails.map(plugin => plugin.name),
    nativePlugins(gameMode)).map(name => name.toLowerCase()));

  const broken = pluginDetails.reduce((prev, plugin) => {
    const missing = plugin.masterList.filter(
      (requiredMaster) => !masters.has(requiredMaster.toLowerCase()));
    if (missing.length > 0) {
      log('info', 'missing masters', { plugin: plugin.name, missing: missing.join(', ') });
      prev[plugin.name] = missing;
    }
    return prev;
  }, {});

  if (Object.keys(broken).length === 0) {
    return Promise.resolve(undefined);
  } else {
    return Promise.resolve({
      description: {
        short: 'Missing Masters',
        long:
        'Some of the enabled plugins depend on others that are not enabled:\n[list]' +
        Object.keys(broken).map(plugin => {
          return '[*] ' + t('[b]{{plugin}}[/b] depends on [b]{{missing}}[/b]', {replace: {
            plugin,
            missing: broken[plugin].join(', '),
          }});
        }).join('\n') + '[/list]',
      },
      severity: 'warning' as types.ProblemSeverity,
    });
  }
}

function replacePluginList(store: Redux.Store<any>, newPlugins: string[]) {
  const plugins = util.getSafe(store.getState(), ['session', 'plugins', 'pluginList'], {});

  Object.keys(plugins).map(key => {
    if (newPlugins.indexOf(key) === -1) {
      store.dispatch(setPluginEnabled(key, false));
    } else {
      store.dispatch(setPluginEnabled(key, true));
    }
  });
}

function init(context: IExtensionContextExt) {
  register(context);
  initPersistor(context);

  context.once(() => {
    const store = context.api.store;

    context.api.setStylesheet('plugin-management', path.join(__dirname, 'plugin_management.scss'));

    loot = new LootInterface(context);

    Object.keys(store.getState().persistent.profiles)
      .forEach((gameId: string) => {
        if (!gameSupported(gameId)) {
          return;
        }
        // this handles the case that the content of a profile changes
        context.api.onStateChange(
          ['persistent', 'profiles', gameId], (oldProfiles, newProfiles) => {
            const activeProfileId = selectors.activeProfile(store.getState()).id;
            const oldProfile = oldProfiles[activeProfileId];
            const newProfile = newProfiles[activeProfileId];

            if (oldProfile !== newProfile) {
              updatePluginList(store, newProfile.modState)
                .then(() => {
                  context.api.events.emit('autosort-plugins');
                });
            }
          });
      });

    context.api.onStateChange(['loadOrder'], () => {
      context.api.events.emit('trigger-test-run', 'plugins-changed', 500);
    });

    context.api.events.on('set-plugin-list', (newPlugins: string[]) => {
      replacePluginList(context.api.store, newPlugins);
      store.dispatch(setPluginOrder(newPlugins));
    });

    context.api.events.on(
        'profile-will-change',
        (nextProfileId: string, enqueue: (cb: () => Promise<void>) => void) => {
          enqueue(() => {
            return stopSync()
              .then(() => userlistPersistor.disable())
              .then(() => masterlistPersistor.disable())
              .then(() => loot.wait());
          });
        });

    context.api.events.on('profile-did-change', (newProfileId: string) => {
      const newProfile =
          util.getSafe(store.getState(),
                       ['persistent', 'profiles', newProfileId], undefined);

      if ((newProfile !== undefined) && gameSupported(newProfile.gameId)) {
        updatePluginList(store, newProfile.modState)
            .then(() => startSync(context.api))
            .then(() => context.api.events.emit('autosort-plugins'));
      }
    });

    context.api.events.on('mod-enabled', (profileId: string, modId: string) => {
      const state: types.IState = context.api.store.getState();
      const currentProfile = selectors.activeProfile(state);
      if ((profileId === currentProfile.id) && gameSupported(currentProfile.gameId)) {
        const mod: types.IMod = state.persistent.mods[currentProfile.gameId][modId];
        fs.readdirAsync(path.join(selectors.installPath(state), mod.installationPath))
            .catch(err => {
              if (err.code === 'ENOENT') {
                context.api.showErrorNotification(
                  'A mod could no longer be found on disk. Please don\'t delete mods manually '
                  + 'but uninstall them through Vortex.', { id: mod.id }, { allowReport: false });
                context.api.store.dispatch(actions.removeMod(currentProfile.gameId, modId));
                return Promise.reject(new util.ProcessCanceled('mod was deleted'));
              } else {
                return Promise.reject(err);
              }
            })
            .then(files => {
              const plugins = files.filter(
                  fileName => ['.esp', '.esm', '.esl'].indexOf(
                                  path.extname(fileName).toLowerCase()) !== -1);
              if (plugins.length === 1) {
                context.api.store.dispatch(setPluginEnabled(plugins[0], true));
              } else if (plugins.length > 1) {
                const t = context.api.translate;
                context.api.sendNotification({
                  type: 'info',
                  message: t('The mod {{ modName }} contains multiple plugins',
                             {
                               replace: {
                                 modName: util.renderModName(mod),
                               },
                             }),
                  actions: [
                    {
                      title: 'Enable all',
                      action: dismiss => {
                        plugins.forEach(plugin => context.api.store.dispatch(
                                            setPluginEnabled(plugin, true)));
                        dismiss();
                      },
                    },
                  ],
                });
              }
            })
            .catch(util.ProcessCanceled, () => undefined);
      }
    });
  });

  return true;
}

export default init;
