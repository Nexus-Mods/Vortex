import {setPluginList} from './actions/plugins';
import {loadOrderReducer} from './reducers/loadOrder';
import {pluginsReducer} from './reducers/plugins';
import {settingsReducer} from './reducers/settings';
import {IPlugins} from './types/IPlugins';
import PluginList from './views/PluginList';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import { log, types, util } from 'nmm-api';
import * as path from 'path';
import * as nodeUtil from 'util';

import PluginPersistor, {PluginFormat} from './util/PluginPersistor';

interface IModState {
  enabled: boolean;
}

type IModStates = { [modId: string]: IModState };

function isPlugin(fileName: string): boolean {
  return ['.esp', '.esm'].indexOf(path.extname(fileName).toLowerCase()) !== -1;
}

function updatePluginList(store: ReactRedux.Store<any>, oldModList: IModStates,
                          newModList: IModStates) {
  if (newModList === undefined) {
    return Promise.resolve({});
  }

  let state = store.getState();

  Promise.reduce(
             Object.keys(newModList),
             (total: IPlugins, modId: string) => {
               if (!newModList[modId].enabled) {
                 return total;
               }
               let mod = state.mods.mods[modId];
               if (mod === undefined) {
                 return total;
               }
               let modPath = mod.installationPath;
               return fs.readdirAsync(modPath).then((fileNames: string[]) => {
                 let pluginNames: string[] = fileNames.filter(isPlugin);
                 let pluginStates: IPlugins = {};
                 pluginNames.forEach((fileName: string) => {
                   pluginStates[fileName] = {
                     modName: modId,
                     filePath: path.join(modPath, fileName),
                   };
                 });
                 return Object.assign({}, total, pluginStates);
               });
             },
             {} as IPlugins)
      .then((newPlugins: IPlugins) => {
        store.dispatch(setPluginList(newPlugins));
      });
}

interface IExtensionContextExt extends types.IExtensionContext {
  registerProfileFile: (gameId: string, filePath: string) => void;
}

function pluginPath(state: any): string {
  let gamePath = {
    skyrim: 'skyrim',
    skyrimse: 'Skyrim Special Edition',
  }[state.settings.gameMode.current];

  if (gamePath === undefined) {
    return undefined;
  }

  const app = appIn || remote.app;
  return path.resolve(app.getPath('appData'), '..', 'Local', gamePath);
}

function pluginFormat(state: any): PluginFormat {
  return {
    skyrim: 'original',
    skyrimse: 'fallout4',
  }[state.settings.gameMode.current];
}

function gameSupported(gameMode: string): boolean {
  return ['skyrim', 'skyrimse'].indexOf(gameMode) !== -1;
}

let persistor: PluginPersistor;

function init(context: IExtensionContextExt) {

  context.registerMainPage('puzzle-piece', 'Plugins', PluginList, {
    hotkey: 'E',
    visible: () => gameSupported(context.api.store.getState().settings.gameMode.current),
  });

  if (context.registerProfileFile) {
    const app = appIn || remote.app;
    let localPath = path.resolve(app.getPath('appData'), '..', 'Local');
    for (let game of [
      { internal: 'skyrim', path: 'Skyrim' },
      { internal: 'skyrimse', path: 'Skyrim Special Edition' },
    ]) {
      context.registerProfileFile(
        game.internal, path.join(localPath, game.path, 'plugins.txt'));
      context.registerProfileFile(
        game.internal, path.join(localPath, game.path, 'loadorder.txt'));
    }
  }

  context.registerReducer(['session', 'plugins'], pluginsReducer);
  context.registerReducer(['loadOrder'], loadOrderReducer);
  context.registerReducer(['settings', 'plugins'], settingsReducer);

  if (persistor === undefined) {
    persistor = new PluginPersistor();
  }
  context.registerPersistor('loadOrder', persistor);

  context.once(() => {
    const store = context.api.store;

    let currentProfile: string =
      util.getSafe(store.getState(), ['gameSettings', 'profiles', 'currentProfile'], undefined);

    updatePluginList(store, {}, util.getSafe(store.getState(),
      ['gameSettings', 'profiles', 'profiles', currentProfile], {} as any).modState);

    context.api.events.on('gamemode-activated', (newGameMode: string) => {
      let state = store.getState();
      persistor.loadFiles(pluginPath(state), pluginFormat(state));
    });

    context.api.events.on('mods-refreshed', () => {
      updatePluginList(
          store, {},
          util.getSafe(store.getState(),
                       ['gameSettings', 'profiles', 'profiles', currentProfile],
                       {} as any)
              .modState);
    });

    context.api.onStateChange(
        ['gameSettings', 'profiles', 'profiles', currentProfile],
        (oldModList, newModList) => {
          log('info', 'state change mods', { oldModList, newModList });
          updatePluginList(store, oldModList.modState, newModList.modState);
        });

    log('info', 'profile', { currentProfile, prof: nodeUtil.inspect(util.getSafe(store.getState(),
      ['gameSettings', 'profiles', 'profiles'], {}))});

    context.api.onStateChange(
        ['gameSettings', 'profiles', 'currentProfile'],
        (oldProfile, newProfile) => {
          log('info', 'state change profile', {oldProfile, newProfile});
          updatePluginList(store,
              util.getSafe(store.getState(),
                           ['gameSettings', 'profiles', 'profiles', oldProfile],
                           {} as any).modState,
              util.getSafe(store.getState(),
                           ['gameSettings', 'profiles', 'profiles', newProfile],
                           {} as any).modState);
          currentProfile = newProfile;
        });
  });

  return true;
}

export default init;
