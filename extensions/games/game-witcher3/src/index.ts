/* eslint-disable */
import Bluebird from 'bluebird';
import path from 'path';
import { actions, fs, log, selectors, types, util } from 'vortex-api';
import winapi from 'winapi-bindings';

import { getPersistentLoadOrder, migrate148 } from './migrations';

import { genCollectionsData, parseCollectionsData } from './collections/collections';
import { IW3CollectionsData } from './collections/types';
import CollectionsDataView from './views/CollectionsDataView';

import { downloadScriptMerger, getScriptMergerDir, setMergerConfig } from './scriptmerger';

import { DO_NOT_DEPLOY, GAME_ID, getLoadOrderFilePath,
  LOCKED_PREFIX, SCRIPT_MERGER_ID
} from './common';

import { testDLC, testTL } from './modTypes';
import { canMergeXML, doMergeXML } from './mergers';

import { registerActions } from './iconbarActions';
import { PriorityManager } from './priorityManager';

import { installContent, installMenuMod, installTL, installDLCMod, installMixed,
  scriptMergerDummyInstaller, scriptMergerTest, testMenuModRoot, testSupportedContent,
  testSupportedTL, testSupportedMixed, testDLCMod } from './installers';

import { W3Reducer } from './reducers';

import { getDLCPath, getAllMods, determineExecutable, getDocumentsPath,
  getTLPath, isTW3, notifyMissingScriptMerger } from './util';
import TW3LoadOrder from './loadOrder';


import { onDidDeploy, onDidPurge, onDidRemoveMod, onGameModeActivation, onModsDisabled,
  onProfileWillChange, onSettingsChange, onWillDeploy } from './eventHandlers';
import IniStructure from './iniParser';

const GOG_ID = '1207664663';
const GOG_ID_GOTY = '1495134320';
const GOG_WH_ID = '1207664643';
const GOG_WH_GOTY = '1640424747';
const STEAM_ID = '499450';
const STEAM_ID_WH = '292030';
const EPIC_ID = '725a22e15ed74735bb0d6a19f3cc82d0';

const tools: types.ITool[] = [
  {
    id: SCRIPT_MERGER_ID,
    name: 'W3 Script Merger',
    logo: 'WitcherScriptMerger.jpg',
    executable: () => 'WitcherScriptMerger.exe',
    requiredFiles: [
      'WitcherScriptMerger.exe',
    ],
  },
  {
    id: GAME_ID + '_DX11',
    name: 'The Witcher 3 (DX11)',
    logo: 'auto',
    relative: true,
    executable: () => 'bin/x64/witcher3.exe',
    requiredFiles: [
      'bin/x64/witcher3.exe',
    ],
  },
  {
    id: GAME_ID + '_DX12',
    name: 'The Witcher 3 (DX12)',
    logo: 'auto',
    relative: true,
    executable: () => 'bin/x64_DX12/witcher3.exe',
    requiredFiles: [
      'bin/x64_DX12/witcher3.exe',
    ],
  },
];

function findGame(): Bluebird<string> {
  try {
    const instPath = winapi.RegGetValue(
      'HKEY_LOCAL_MACHINE',
      'Software\\CD Project Red\\The Witcher 3',
      'InstallFolder');
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Bluebird.resolve(instPath.value as string);
  } catch (err) {
    return util.GameStoreHelper.findByAppId([
      GOG_ID_GOTY, GOG_ID, GOG_WH_ID, GOG_WH_GOTY,
      STEAM_ID, STEAM_ID_WH, EPIC_ID
    ])
      .then(game => game.gamePath);
  }
}

function prepareForModding(api: types.IExtensionApi) {
  return (discovery: types.IDiscoveryResult) => {
    const findScriptMerger = async (error) => {
      log('error', 'failed to download/install script merger', error);
      const scriptMergerPath = await getScriptMergerDir(api);
      if (scriptMergerPath === undefined) {
        notifyMissingScriptMerger(api);
        return Promise.resolve();
      } else {
        if (discovery?.tools?.W3ScriptMerger === undefined) {
          return setMergerConfig(discovery.path, scriptMergerPath);
        }
      }
    };
    const ensurePath = (dirpath) =>
      fs.ensureDirWritableAsync(dirpath)
        .catch(err => (err.code === 'EEXIST')
          ? Promise.resolve()
          : Promise.reject(err));
  
    return Promise.all([
      ensurePath(path.join(discovery.path, 'Mods')),
      ensurePath(path.join(discovery.path, 'DLC')),
      ensurePath(path.dirname(getLoadOrderFilePath()))])
        .then(() => downloadScriptMerger(api)
          .catch(err => (err instanceof util.UserCanceled)
            ? Promise.resolve()
            : findScriptMerger(err)));
  }
}

let priorityManager: PriorityManager;
const getPriorityManager = () => priorityManager;
// let modLimitPatcher: ModLimitPatcher;

function main(context: types.IExtensionContext) {
  context.registerReducer(['settings', 'witcher3'], W3Reducer);
  context.registerGame({
    id: GAME_ID,
    name: 'The Witcher 3',
    mergeMods: true,
    queryPath: findGame,
    queryModPath: () => 'Mods',
    logo: 'gameart.jpg',
    executable: determineExecutable,
    setup: prepareForModding(context.api) as any,
    supportedTools: tools,
    requiresCleanup: true,
    requiredFiles: [
      'bin/x64/witcher3.exe',
    ],
    environment: {
      SteamAPPId: '292030',
    },
    details: {
      steamAppId: 292030,
      ignoreConflicts: DO_NOT_DEPLOY,
      ignoreDeploy: DO_NOT_DEPLOY,
    },
  });

  context.registerInstaller('scriptmergerdummy', 15, scriptMergerTest as any, scriptMergerDummyInstaller as any);
  context.registerInstaller('witcher3menumodroot', 20, testMenuModRoot as any, installMenuMod as any);
  context.registerInstaller('witcher3mixed', 25, testSupportedMixed as any, installMixed as any);
  context.registerInstaller('witcher3tl', 30, testSupportedTL as any, installTL as any);
  context.registerInstaller('witcher3content', 50, testSupportedContent as any, installContent as any);
  context.registerInstaller('witcher3dlcmod', 60, testDLCMod as any, installDLCMod as any);

  context.registerModType('witcher3menumodroot', 20, isTW3(context.api), getTLPath(context.api), testMenuModRoot as any);
  context.registerModType('witcher3tl', 25, isTW3(context.api), getTLPath(context.api), testTL as any);
  context.registerModType('witcher3dlc', 25, isTW3(context.api), getDLCPath(context.api), testDLC as any);
  context.registerModType('w3modlimitpatcher', 25, isTW3(context.api), getTLPath(context.api), () => Bluebird.resolve(false),
    { deploymentEssential: false, name: 'Mod Limit Patcher Mod Type' });
  context.registerModType('witcher3menumoddocuments', 60, isTW3(context.api), getDocumentsPath, () => Bluebird.resolve(false));

  context.registerMerge(canMergeXML(context.api), doMergeXML(context.api) as any, 'witcher3menumodroot');
  // context.registerMerge(canMergeSettings(context.api), doMergeSettings(context.api) as any, 'witcher3menumoddocuments');

  context.registerMigration((oldVersion) => (migrate148(context, oldVersion) as any));

  registerActions({ context, getPriorityManager });

  context.optional.registerCollectionFeature(
    'witcher3_collection_data',
    (gameId: string, includedMods: string[], collection: types.IMod) =>
      genCollectionsData(context, gameId, includedMods, collection),
    (gameId: string, collection: IW3CollectionsData) =>
      parseCollectionsData(context, gameId, collection),
    () => Promise.resolve(),
    (t) => t('Witcher 3 Data'),
    (state: types.IState, gameId: string) => gameId === GAME_ID,
    CollectionsDataView,
  );

  context.registerProfileFeature(
    'local_merges', 'boolean', 'settings', 'Profile Data',
    'This profile will store and restore profile specific data (merged scripts, loadorder, etc) when switching profiles',
    () => {
      const activeGameId = selectors.activeGameId(context.api.getState());
      return activeGameId === GAME_ID;
    });

  const toggleModsState = async (enabled) => {
    const state = context.api.store.getState();
    const profile = selectors.activeProfile(state);
    const loadOrder = getPersistentLoadOrder(context.api);
    const modMap = await getAllMods(context.api);
    const manualLocked = modMap.manual.filter(modName => modName.startsWith(LOCKED_PREFIX));
    const totalLocked = [].concat(modMap.merged, manualLocked);
    const newLO = loadOrder.reduce((accum, key, idx) => {
      if (totalLocked.includes(key)) {
        accum.push(loadOrder[idx]);
      } else {
        accum.push({
          ...loadOrder[idx],
          enabled,
        });
      }
      return accum;
    }, []);
    context.api.store.dispatch(actions.setLoadOrder(profile.id, newLO as any));
  };
  const props = {
    onToggleModsState: toggleModsState,
    api: context.api,
    getPriorityManager,
  }
  context.registerLoadOrder(new TW3LoadOrder(props));
  // context.registerTest('tw3-mod-limit-breach', 'gamemode-activated',
  //   () => Bluebird.resolve(testModLimitBreach(context.api, modLimitPatcher)));
  // context.registerTest('tw3-mod-limit-breach', 'mod-activated',
  //   () => Bluebird.resolve(testModLimitBreach(context.api, modLimitPatcher)));

  context.once(() => {
    priorityManager = new PriorityManager(context.api, 'prefix-based');
    IniStructure.getInstance(context.api, getPriorityManager);
    // modLimitPatcher = new ModLimitPatcher(context.api);

    context.api.events.on('gamemode-activated', onGameModeActivation(context.api));
    context.api.events.on('profile-will-change', onProfileWillChange(context.api));
    context.api.events.on('mods-enabled', onModsDisabled(context.api, getPriorityManager));

    context.api.onAsync('will-deploy', onWillDeploy(context.api) as any);
    context.api.onAsync('did-deploy', onDidDeploy(context.api) as any);
    context.api.onAsync('did-purge', onDidPurge(context.api, getPriorityManager) as any);
    context.api.onAsync('did-remove-mod', onDidRemoveMod(context.api, getPriorityManager) as any);

    context.api.onStateChange(['settings', 'witcher3'], onSettingsChange(context.api, getPriorityManager) as any);
  });
  return true;
}

module.exports = {
  default: main,
};
