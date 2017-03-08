import { app as appIn, remote } from 'electron';
import { types } from 'nmm-api';
import * as path from 'path';

const app = appIn || remote.app;

const gameSupport = {
  skyrim: {
    mygamesPath: 'skyrim',
    iniFiles: ['Skyrim.ini', 'SkyrimPrefs.ini'],
  },
  skyrimse: {
    mygamesPath: 'Skyrim Special Edition',
    iniFiles: ['Skyrim.ini'],
  },
  fallout4: {
    mygamesPath: 'Fallout4',
    iniFiles: ['Fallout4.ini'],
  },
  falloutnv: {
    mygamesPath: 'FalloutNV',
    iniFiles: ['Fallout.ini'],
  },
  oblivion: {
    mygamesPath: 'Oblivion',
    iniFiles: ['Oblivion.ini'],
  },
};

export function gameSupported(gameMode: string): boolean {
  return gameSupport[gameMode] !== undefined;
}

export function mygamesPath(gameMode: string): string {
  return path.join(app.getPath('documents'), 'My Games',
                   gameSupport[gameMode].mygamesPath);
}

export function iniFiles(gameMode: string): string[] {
  const { iniFiles } = gameSupport[gameMode];
  return iniFiles;
}

export function profilePath(store: Redux.Store<any>, profile: types.IProfile): string {
  return path.join(app.getPath('userData'), profile.gameId, 'profiles', profile.id);
}

export function backupPath(store: Redux.Store<any>, profile: types.IProfile): string {
  return path.join(app.getPath('userData'), profile.gameId);
}

