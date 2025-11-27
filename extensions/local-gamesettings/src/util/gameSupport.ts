import * as path from 'path';
import * as Redux from 'redux';
import { selectors, types, util } from 'vortex-api';

export interface ISettingsFile {
  name: string;
  optional: boolean;
}

export interface IGameSupportEntry {
  mygamesPath: string;
  gameSettingsFiles: Array<string | ISettingsFile>;
}

const gameSupport = util.makeOverlayableDictionary<string, IGameSupportEntry>({
  skyrim: {
    mygamesPath: 'skyrim',
    gameSettingsFiles: ['Skyrim.ini', 'SkyrimPrefs.ini'],
  },
  enderal: {
    mygamesPath: 'Enderal',
    gameSettingsFiles: ['Enderal.ini', 'EnderalPrefs.ini'],
  },
  skyrimse: {
    mygamesPath: 'Skyrim Special Edition',
    gameSettingsFiles: ['Skyrim.ini', 'SkyrimPrefs.ini',
      { name: 'SkyrimCustom.ini', optional: true }],
  },
  enderalspecialedition: {
    mygamesPath: 'Enderal Special Edition',
    gameSettingsFiles: ['Enderal.ini', 'EnderalPrefs.ini'],
  },
  skyrimvr: {
    mygamesPath: 'Skyrim VR',
    gameSettingsFiles: ['Skyrim.ini', 'SkyrimVR.ini', 'SkyrimPrefs.ini'],
  },
  fallout3: {
    mygamesPath: 'Fallout3',
    gameSettingsFiles: ['Fallout.ini', 'FalloutPrefs.ini',
      { name: 'FalloutCustom.ini', optional: true }],
  },
  fallout4: {
    mygamesPath: 'Fallout4',
    gameSettingsFiles: ['Fallout4.ini', 'Fallout4Prefs.ini',
      { name: 'Fallout4Custom.ini', optional: true }],
  },
  fallout4vr: {
    mygamesPath: 'Fallout4VR',
    gameSettingsFiles: ['Fallout4Custom.ini', 'Fallout4Prefs.ini'],
  },
  starfield: {
    mygamesPath: 'Starfield',
    gameSettingsFiles: ['StarfieldCustom.ini', 'StarfieldPrefs.ini'],
  },
  falloutnv: {
    mygamesPath: 'FalloutNV',
    gameSettingsFiles: ['Fallout.ini', 'FalloutPrefs.ini',
      { name: 'FalloutCustom.ini', optional: true }],
  },
  oblivion: {
    mygamesPath: 'Oblivion',
    gameSettingsFiles: ['Oblivion.ini'],
  },
  oblivionremastered: {
    mygamesPath: path.join('Oblivion Remastered', 'Saved', 'Config', 'Windows'),
    gameSettingsFiles: ['Altar.ini'],
  },
}, {
  xbox: {
    skyrimse: {
      mygamesPath: 'Skyrim Special Edition MS',
    },
    fallout4: {
      mygamesPath: 'Fallout4 MS',
    },
  },
  gog: {
    skyrimse: {
      mygamesPath: 'Skyrim Special Edition GOG',
    },
    enderalspecialedition: {
      mygamesPath: 'Enderal Special Edition GOG',
    },
  },
  epic: {
    skyrimse: {
      mygamesPath: 'Skyrim Special Edition EPIC',
    },
    fallout4: {
      mygamesPath: 'Fallout4 EPIC',
    },
  },
  enderalseOverlay: {
    enderalspecialedition: {
      mygamesPath: 'Skyrim Special Edition',
      gameSettingsFiles: ['Skyrim.ini', 'SkyrimPrefs.ini',
        { name: 'SkyrimCustom.ini', optional: true }],
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

let discoveryForGame: (gameId: string) => types.IDiscoveryResult = () => undefined;

export function initGameSupport(api: types.IExtensionApi) {
  discoveryForGame = (gameId: string) => selectors.discoveryByGame(api.store.getState(), gameId);
}

export function gameSupported(gameMode: string): boolean {
  return gameSupport.has(gameMode);
}

export function mygamesPath(gameMode: string): string {
  return path.join(util.getVortexPath('documents'), 'My Games', gameSupport.get(gameMode, 'mygamesPath'));
}

export function gameSettingsFiles(gameMode: string, customPath: string): ISettingsFile[] {
  const fileNames = gameSupport.get(gameMode, 'gameSettingsFiles');

  const mapFile = (input: string | ISettingsFile): ISettingsFile => typeof(input) === 'string'
    ? { name: input, optional: false }
    : input;

  if (customPath === null) {
    return fileNames.map(mapFile);
  } else {
    return fileNames
      .map(mapFile)
      .map(input => ({ name: path.join(customPath, input.name), optional: input.optional }));
  }
}

export function profilePath(profile: types.IProfile): string {
  return path.join(util.getVortexPath('userData'), profile.gameId, 'profiles', profile.id);
}

export function backupPath(profile: types.IProfile): string {
  return path.join(util.getVortexPath('userData'), profile.gameId);
}
