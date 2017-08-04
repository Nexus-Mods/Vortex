import { app as appIn, remote } from 'electron';
import { types } from 'nmm-api';
import * as path from 'path';

const app = appIn || remote.app;

const gameSupport = {
  skyrim: {
    mygamesPath: 'skyrim',
    gameSettingsFiles: ['Skyrim.ini', 'SkyrimPrefs.ini'],
  },
  skyrimse: {
    mygamesPath: 'Skyrim Special Edition',
    gameSettingsFiles: ['Skyrim.ini', 'SkyrimPrefs.ini'],
  },
  fallout3: {
    mygamesPath: 'Fallout3',
    gameSettingsFiles: ['Fallout3.ini'],
  },
  fallout4: {
    mygamesPath: 'Fallout4',
    gameSettingsFiles: ['Fallout4.ini', 'Fallout4Prefs.ini'],
  },
  falloutnv: {
    mygamesPath: 'FalloutNV',
    gameSettingsFiles: ['Fallout.ini', 'FalloutPrefs.ini'],
  },
  oblivion: {
    mygamesPath: 'Oblivion',
    gameSettingsFiles: ['Oblivion.ini'],
  },
};

export function gameSupported(gameMode: string): boolean {
  return gameSupport[gameMode] !== undefined;
}

export function mygamesPath(gameMode: string): string {
  return path.join(app.getPath('documents'), 'My Games',
                   gameSupport[gameMode].mygamesPath);
}

export function gameSettingsFiles(gameMode: string, customPath: string): string[] {
  const { gameSettingsFiles } = gameSupport[gameMode];
  if (customPath === null) {
    return gameSettingsFiles;
  } else {
    const fileList: string[] = [];
    gameSettingsFiles.forEach(file => {
      fileList.push(path.join(customPath, file));
    });
    return fileList;
  }
}

export function profilePath(profile: types.IProfile): string {
  return path.join(app.getPath('userData'), profile.gameId, 'profiles', profile.id);
}

export function backupPath(profile: types.IProfile): string {
  return path.join(app.getPath('userData'), profile.gameId);
}
