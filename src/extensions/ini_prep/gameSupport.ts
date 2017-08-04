import { getSafe } from '../../util/storeHelper';

import { app as appIn, remote } from 'electron';
import * as path from 'path';
import format = require('string-template');

const app = appIn || remote.app;

const gameSupport = {
  skyrim: {
    iniFiles: [
      '{mygames}/Skyrim/Skyrim.ini',
      '{mygames}/Skyrim/SkyrimPrefs.ini',
    ],
    iniFormat: 'winapi',
  },
  skyrimse: {
    iniFiles: [
      '{mygames}/Skyrim Special Edition/Skyrim.ini',
      '{mygames}/Skyrim Special Edition/SkyrimPrefs.ini',
    ],
    iniFormat: 'winapi',
  },
  fallout3: {
    iniFiles: [
      '{mygames}/Fallout3/Fallout4.ini',
    ],
    iniFormat: 'winapi',
  },
  fallout4: {
    iniFiles: [
      '{mygames}/Fallout4/Fallout4.ini',
      '{mygames}/Fallout4/Fallout4Prefs.ini',
    ],
    iniFormat: 'winapi',
  },
  falloutnv: {
    iniFiles: [
      '{mygames}/FalloutNV/Fallout.ini',
      '{mygames}/FalloutNV/FalloutPrefs.ini',
    ],
    iniFormat: 'winapi',
  },
  oblivion: {
    iniFiles: [
      '{mygames}/Oblivion/Oblivion.ini',
    ],
    iniFormat: 'winapi',
  },
};

export function iniFiles(gameMode: string) {
  const mygames = path.join(app.getPath('documents'), 'My Games');
  return getSafe(gameSupport, [gameMode, 'iniFiles'], []).map(file => format(file, {
    mygames }));
}

export function iniFormat(gameMode: string) {
  return getSafe(gameSupport, [gameMode, 'iniFormat'], undefined);
}
