import { app as appIn, remote } from 'electron';
import * as path from 'path';

const app = appIn || remote.app;

function bethIni(gamePath: string, iniName: string) {
  return path.join(app.getPath('documents'), 'My Games', gamePath, iniName + '.ini');
}

const gameSupport = {
  fallout4: {
    iniPath: () => bethIni('Fallout4', 'Fallout4'),
  },
  falloutnv: {
    iniPath: () => bethIni('FalloutNV', 'Fallout'),
  },
  oblivion: {
    iniPath: () => bethIni('Oblivion', 'Oblivion'),
  },
  skyrim: {
    iniPath: () => bethIni('Skyrim', 'Skyrim'),
  },
  skyrimse: {
    iniPath: () => bethIni('Skyrim Special Edition', 'Skyrim'),
  },
};

export function getIniFilePath(gameMode: string) {
  if ((gameSupport[gameMode] === undefined)
      || (gameSupport[gameMode].iniPath === undefined)) {
    return '';
  }

  return gameSupport[gameMode].iniPath();
}
