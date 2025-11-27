/* eslint-disable */
import {PluginFormat} from '../util/PluginPersistor';
import memoizeOne from 'memoize-one';

import Promise from 'bluebird';

import * as path from 'path';
import { fs, log, selectors, types, util } from 'vortex-api';

import { patternMatchNativePlugins } from './patternMatchNativePlugins';

type PluginTXTFormat = 'original' | 'fallout4';

export interface IGameSupport {
  // The general path to the game's app data folder within the
  //  local app folder.
  appDataPath: string;

  // The path to the plugins.txt file.
  pluginsPath?: string;

  // the path to the game's data folder (where the .esm/.esp files are)
  gameDataPath?: string;

  pluginTXTFormat: PluginTXTFormat;
  nativePlugins: string[];
  nativePluginsPatterns?: string[];
  supportsESL?: boolean | (() => boolean);
  supportsMediumMasters?: boolean | (() => boolean);
  minRevision?: number;
}

const gameSupport = util.makeOverlayableDictionary<string, IGameSupport>({
  skyrim: {
    appDataPath: 'Skyrim',
    pluginTXTFormat: 'original',
    nativePlugins: [
      'skyrim.esm',
      'update.esm',
    ],
  },
  enderal: {
    appDataPath: 'Enderal',
    pluginTXTFormat: 'original',
    nativePlugins: [
      'skyrim.esm',
    ],
  },
  skyrimse: {
    appDataPath: 'Skyrim Special Edition',
    pluginTXTFormat: 'fallout4',
    nativePlugins: [
      'skyrim.esm',
      'update.esm',
      'dawnguard.esm',
      'hearthfires.esm',
      'dragonborn.esm',
      'ccBGSSSE002-ExoticArrows.esl',
      'ccBGSSSE003-Zombies.esl',
      'ccBGSSSE004-RuinsEdge.esl',
      'ccBGSSSE006-StendarsHammer.esl',
      'ccBGSSSE007-Chrysamere.esl',
      'ccBGSSSE010-PetDwarvenArmoredMudcrab.esl',
      'ccBGSSSE014-SpellPack01.esl',
      'ccBGSSSE019-StaffofSheogorath.esl',
      'ccBGSSSE021-LordsMail.esl',
      'ccMTYSSE001-KnightsoftheNine.esl',
      'ccQDRSSE001-SurvivalMode.esl',
      'ccTWBSSE001-PuzzleDungeon.esm',
      'ccEEJSSE001-Hstead.esl',
    ],
    supportsESL: true,
    minRevision: 44,
  },
  skyrimvr: {
    appDataPath: 'Skyrim VR',
    pluginTXTFormat: 'fallout4',
    nativePlugins: [
      'skyrim.esm',
      'update.esm',
      'dawnguard.esm',
      'hearthfires.esm',
      'dragonborn.esm',
      'skyrimvr.esm',
    ],
    // skyrim vr does *not* support esls by default. However, it is possible to enable them
    //  with a mod https://www.nexusmods.com/skyrimspecialedition/mods/106712
    supportsESL: false,
  },
  fallout3: {
    appDataPath: 'Fallout3',
    pluginTXTFormat: 'original',
    nativePlugins: [
      'fallout3.esm',
    ],
  },
  fallout4: {
    appDataPath: 'Fallout4',
    pluginTXTFormat: 'fallout4',
    nativePlugins: [
      'fallout4.esm',
      'dlcrobot.esm',
      'dlcworkshop01.esm',
      'dlccoast.esm',
      'dlcworkshop02.esm',
      'dlcworkshop03.esm',
      'dlcnukaworld.esm',
      'dlcultrahighresolution.esm',
      'ccbgsfo4001-pipboy(black).esl',
      'ccbgsfo4002-pipboy(blue).esl',
      'ccbgsfo4003-pipboy(camo01).esl',
      'ccbgsfo4004-pipboy(camo02).esl',
      'ccbgsfo4006-pipboy(chrome).esl',
      'ccbgsfo4012-pipboy(red).esl',
      'ccbgsfo4014-pipboy(white).esl',
      'ccbgsfo4016-prey.esl',
      'ccbgsfo4017-mauler.esl',
      'ccbgsfo4018-gaussrifleprototype.esl',
      'ccbgsfo4019-chinesestealtharmor.esl',
      'ccbgsfo4020-powerarmorskin(black).esl',
      'ccbgsfo4022-powerarmorskin(camo01).esl',
      'ccbgsfo4023-powerarmorskin(camo02).esl',
      'ccbgsfo4025-powerarmorskin(chrome).esl',
      'ccbgsfo4038-horsearmor.esl',
      'ccbgsfo4039-tunnelsnakes.esl',
      'ccbgsfo4041-doommarinearmor.esl',
      'ccbgsfo4042-bfg.esl',
      'ccbgsfo4043-doomchainsaw.esl',
      'ccbgsfo4044-hellfirepowerarmor.esl',
      'ccbgsfo4046-tescan.esl',
      'ccbgsfo4096-as_enclave.esl',
      'ccbgsfo4110-ws_enclave.esl',
      'ccbgsfo4115-x02.esl',
      'ccbgsfo4116-heavyflamer.esl',
      'cceejfo4001-decorationpack.esl',
      'ccfrsfo4001-handmadeshotgun.esl',
      'ccfsvfo4001-modularmilitarybackpack.esl',
      'ccfsvfo4002-midcenturymodern.esl',
      'ccfsvfo4007-halloween.esl',
      'ccotmfo4001-remnants.esl',
      'ccsbjfo4003-grenade.esl',
    ],
    supportsESL: true,
  },
  fallout4vr: {
    appDataPath: 'Fallout4VR',
    pluginTXTFormat: 'fallout4',
    nativePlugins: [
      'fallout4.esm',
      'fallout4_vr.esm',
    ],
  },
  falloutnv: {
    appDataPath: 'falloutnv',
    pluginTXTFormat: 'original',
    nativePlugins: [
      'falloutnv.esm',
    ],
  },
  starfield: {
    appDataPath: 'Starfield',
    pluginTXTFormat: 'fallout4',
    nativePlugins: [
      'starfield.esm',
      'constellation.esm',
      'oldmars.esm',
      'shatteredspace.esm',
      'blueprintships-starfield.esm',
      'sfbgs003.esm',
      'sfbgs004.esm',
      'sfbgs006.esm',
      'sfbgs007.esm',
      'sfbgs008.esm',
    ],
    nativePluginsPatterns: ['^sfbgs00[0-8]\.esm$'],
    supportsESL: true,
    supportsMediumMasters: true,
  },
  oblivion: {
    appDataPath: 'oblivion',
    pluginTXTFormat: 'original',
    nativePlugins: [
      'oblivion.esm',
    ],
  },
  oblivionremastered: {
    appDataPath: 'Oblivion Remastered',
    pluginTXTFormat: 'original',
    nativePlugins: [
      'oblivion.esm',
      'dlcbattlehorncastle.esp',
      'dlcfrostcrag.esp',
      'dlchorsearmor.esp',
      'dlcmehrunesrazor.esp',
      'dlcorrery.esp',
      'dlcshiveringisles.esp',
      'dlcspelltomes.esp',
      'dlcthievesden.esp',
      'dlcvilelair.esp',
      'knights.esp',
      'altarespmain.esp',
      'altardeluxe.esp',
      'altaresplocal.esp',
    ],
  },
  enderalspecialedition: {
    appDataPath: 'Enderal Special Edition',
    pluginTXTFormat: 'fallout4',
    nativePlugins: [
      'skyrim.esm',
      'update.esm',
      'dawnguard.esm',
      'hearthfires.esm',
      'dragonborn.esm',
    ],
    supportsESL: true,
  },
}, {
  xbox: {
    skyrimse: {
      appDataPath: 'Skyrim Special Edition MS',
    },
    fallout4: {
      appDataPath: 'Fallout4 MS',
    },
    oblivion: {
      appDataPath: 'Oblivion',
    },
  },
  gog: {
    skyrimse: {
      appDataPath: 'Skyrim Special Edition GOG',
    },
    enderalspecialedition: {
      appDataPath: 'Enderal Special Edition GOG',
    }
  },
  epic: {
    skyrimse: {
      appDataPath: 'Skyrim Special Edition EPIC',
    },
    fallout4: {
      appDataPath: 'Fallout4 EPIC',
    },
  },
  enderalseOverlay: {
    enderalspecialedition: {
      appDataPath: 'Skyrim Special Edition',
    },
  },
}, (gameId: string) => {
  const discovery = discoveryForGame(gameId);
  if ((discovery?.path !== undefined)
      && (gameId === 'enderalspecialedition')
      && discovery.path.includes('skyrim')) {
    return 'enderalseOverlay';
  }
  else {
    return discovery?.store;
  }
});

function applyNativePlugins(api: types.IExtensionApi, gameMode: string, fileName: string): Promise<void> {
  const state = api.store.getState();
  const game = selectors.gameById(state, gameMode);
  const nativePlugins = game?.details?.nativePlugins || gameSupport[gameMode].nativePlugins;
  const gameNativePlugins = new Set<string>(nativePlugins);
  const discovery = discoveryForGame(gameMode);
  if (discovery?.path === undefined || !game) {
    return Promise.resolve();
  } else {
    const cccFilePath = path.join(discovery.path, fileName);
    return Promise.resolve()
      .then(() => patternMatchNativePlugins(gameMode, discovery, gameSupport[gameMode]))
      .then((patternMatched) => {
        patternMatched.forEach(fileName => { gameNativePlugins.add(fileName.toLowerCase()); });
        return fs.readFileAsync(cccFilePath);
      })
      .then((data) => {
        const lines = data.toString().split('\r\n').filter(plugin => plugin !== '');
        lines.forEach(plugin => { gameNativePlugins.add(plugin.toLowerCase()); });
      })
      .catch((err) => {
        log('info', `failed to read ${fileName}`, err.message);
      })
      .finally(() => {
        gameSupport[gameMode].nativePlugins = Array.from(gameNativePlugins);
      });
  }
}

export function getGameSupport() {
  return gameSupport;
}

export function syncGameSupport(gameId: string, gameSupportData: IGameSupport): void {
  if (process.type === 'browser' && gameSupport.has(gameId)) {
    // Synchronize the game support data in the main thread with the one in the renderer.
    const currentSupportData = gameSupport[gameId];
    const mergedSupportData = { ...currentSupportData, ...gameSupportData };
    Object.assign(gameSupport[gameId], mergedSupportData);
  }
}

let discoveryForGame: (gameId: string) => types.IDiscoveryResult = () => undefined;
let getApi: () => types.IExtensionApi = () => undefined;
export function initGameSupport(api: types.IExtensionApi): Promise<void> {
  discoveryForGame = (gameId: string) => selectors.discoveryByGame(api.store.getState(), gameId);
  getApi = () => api;
  const state: types.IState = api.store.getState();
  const { discovered } = state.settings.gameMode;

  return Promise.resolve()
    .then(() => Promise.all([
      applyNativePlugins(api, 'skyrimse', 'Skyrim.ccc'),
      applyNativePlugins(api, 'fallout4', 'Fallout4.ccc'),
      applyNativePlugins(api, 'starfield', 'Starfield.ccc'),
      applyNativePlugins(api, 'oblivionremastered', 'Oblivion.ccc'),
    ]))
    .then(() => {
      if (discovered['skyrimvr']?.path !== undefined) {
        const game = selectors.gameById(state, 'skyrimvr');
        if (game?.details?.supportsESL !== undefined) {
          gameSupport['skyrimvr'].supportsESL = game.details.supportsESL;
        }
      }
      if (discovered['oblivionremastered']?.path !== undefined) {
        const game = selectors.gameById(state, 'oblivionremastered');
        const dataModType = game?.details?.dataModType;
        if (dataModType && process.type === 'renderer') {
          // The main thread can't deal with most selectors. We rely on the IPC channels
          //  to sync the data over to it.
          const pluginsPath = selectors.modPathsForGame(state, 'oblivionremastered')[dataModType];
          gameSupport['oblivionremastered'].pluginsPath = pluginsPath;
          gameSupport['oblivionremastered'].gameDataPath = pluginsPath;
        }
      }
      return Promise.resolve();
    });
}

export function appDataPath(gameMode: string): string {
  const dataPath = gameSupport.get(gameMode, 'appDataPath');

  return (process.env.LOCALAPPDATA !== undefined)
    ? path.join(process.env.LOCALAPPDATA, dataPath)
    : path.resolve(util.getVortexPath('appData'), '..', 'Local', dataPath);
}

export function gameDataPath(gameMode: string): string {
  const customDataPath = gameSupport.get(gameMode, 'gameDataPath');
  if (customDataPath) {
    return customDataPath;
  }
  const discovery = discoveryForGame(gameMode);
  return path.join(discovery.path, 'Data');
}

export function pluginPath(gameMode: string): string {
  // The path of the plugins.txt file, not the path to where the game
  //  stores its plugins.
  const pluginsPath = gameSupport.get(gameMode, 'pluginsPath');
  if (pluginsPath) {
    return pluginsPath;
  }
  return appDataPath(gameMode);
}

export function pluginFormat(gameMode: string): PluginFormat {
  return gameSupport.get(gameMode, 'pluginTXTFormat');
}

export function supportedGames(): string[] {
  return Object.keys(gameSupport);
}

export function gameSupported(gameMode: string, sort?: boolean): boolean {
  if (sort) {
    // We don't want to block the sort mechanism from running even if the
    //  plugin management is disabled. In this case we just make sure we
    //  have a value for the game.
    return gameSupport.has(gameMode);
  }
  const state = getApi().getState();
  const defaultVal = ['starfield', 'oblivionremastered'].includes(gameMode) ? false : true;
  const profileId = selectors.lastActiveProfileForGame(state, gameMode);
  if (!util.getSafe(state, ['settings', 'plugins', 'pluginManagementEnabled', profileId], defaultVal)) {
    return false;
  }
  return gameSupport.has(gameMode);
}

export function isNativePlugin(gameMode: string, pluginName: string): boolean {
  return gameSupport.get(gameMode, 'nativePlugins').includes(pluginName.toLowerCase());
}

export function nativePlugins(gameMode: string): string[] {
  return gameSupport.get(gameMode, 'nativePlugins');
}

export const supportsESL = memoizeOne((gameMode: string): boolean => {
  if (!gameSupport.has(gameMode)) {
    return false;
  }
  const supportsESL = gameSupport.get(gameMode, 'supportsESL') ?? false;
  if (typeof supportsESL === 'function') {
    return supportsESL();
  }
  return supportsESL;
});

export const supportsMediumMasters = memoizeOne((gameMode: string): boolean => {
  if (!gameSupport.has(gameMode)) {
    return false;
  }
  const supportsMediumMasters = gameSupport.get(gameMode, 'supportsMediumMasters') ?? false;
  if (typeof supportsMediumMasters === 'function') {
    return supportsMediumMasters();
  }
  return supportsMediumMasters;
});

export function pluginExtensions(gameMode: string): string[] {
  return supportsESL(gameMode)
    ? ['.esm', '.esp', '.esl']
    : ['.esm', '.esp'];
}

export function minRevision(gameMode: string): number {
  return gameSupport.get(gameMode, 'minRevision') ?? 0;
}

export function revisionText(gameMode: string): string {
  if (gameMode === 'skyrimse') {
    return 'This plugin was created for the original Skyrim and may be incompatible '
         + 'with Skyrim Special Edition. This can cause unforseen problems during gameplay.';
  } else {
    return 'Plugin not compatible with this game';
  }
}
