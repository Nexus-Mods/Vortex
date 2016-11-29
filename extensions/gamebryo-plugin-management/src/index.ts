import {setPluginList} from './actions/plugins';
import {pluginsReducer} from './reducers/plugins';
import {IPluginStates} from './types/IPluginState';
import PluginList from './views/PluginList';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import { log, types, util } from 'nmm-api';
import * as path from 'path';
import * as nodeUtil from 'util';

interface IModState {
  enabled: boolean;
}

type IModStates = { [modId: string]: IModState };

let plugins: IPluginStates = {};

function isPlugin(fileName: string): boolean {
  return ['.esp', '.esm'].indexOf(path.extname(fileName).toLowerCase()) !== -1;
}

function updatePluginList(store: ReactRedux.Store<any>, oldModList: IModStates,
                          newModList: IModStates) {
  console.log('upl');
  if (newModList === undefined) {
    return Promise.resolve({});
  }

  let state = store.getState();

  let profile = state.gameSettings.profiles.currentProfile;

  let addCount = 0;
  Promise.reduce(
             Object.keys(newModList),
             (total: IPluginStates, modId: string) => {
               if (!newModList[modId].enabled) {
                 return total;
               }
               let mod = state.mods.mods[modId];
               if (mod === undefined) {
                 return total;
               }
               let modPath = mod.installationPath;
               console.log('read', modPath);
               return fs.readdirAsync(modPath).then((fileNames: string[]) => {
                 let pluginNames: string[] = fileNames.filter(isPlugin);
                 log('info', 'plugin names', pluginNames);
                 let pluginStates: IPluginStates = {};
                 let totalLength = Object.keys(total).length;
                 pluginNames.forEach((fileName: string) => {
                   let existing = util.getSafe(plugins, [fileName], undefined);
                   log('info', 'existing', nodeUtil.inspect(existing));
                   if (existing !== undefined) {
                     pluginStates[fileName] = existing;
                   } else {
                     pluginStates[fileName] = {
                       enabled: false,
                       loadOrder: totalLength + addCount,
                       mod: modId,
                       filePath: path.join(modPath, fileName),
                     };
                     addCount += 1;
                   }
                 });
                 return Object.assign({}, total, pluginStates);
               });
             },
             {} as IPluginStates)
      .then((newPlugins: IPluginStates) => {
        store.dispatch(setPluginList(profile, newPlugins));
        console.log('/upl', newPlugins);
      });
}

interface IExtensionContextExt extends types.IExtensionContext {
  registerProfileFile: (gameId: string, filePath: string) => void;
}

function main(context: IExtensionContextExt) {
  context.registerMainPage('puzzle-piece', 'Plugins', PluginList, {
    hotkey: 'E',
    props: () => {
      log('info', 'called props');
      return { plugins };
    },
  });

  if (context.registerProfileFile) {
    const app = appIn || remote.app;
    context.registerProfileFile(
        'skyrimse', path.resolve(app.getPath('appData'), '..', 'Local',
                                 'Skyrim Special Edition', 'plugins.txt'));
  }

  context.registerReducer(['gameSettings', 'profiles'], pluginsReducer);

  context.once(() => {
    const store = context.api.store;
    let currentProfile: string =
      util.getSafe(store.getState(), ['gameSettings', 'profiles', 'currentProfile'], undefined);

    log('info', 'update plugin list', {currentProfile});
    updatePluginList(store, {}, util.getSafe(store.getState(),
      ['gameSettings', 'profiles', 'profiles', currentProfile], {} as any).modState);

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

export default main;
