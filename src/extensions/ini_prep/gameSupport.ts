import { getSafe } from '../../util/storeHelper';

import { app as appIn, remote } from 'electron';
import * as path from 'path';
import format = require('string-template');
import { IState } from '../../types/IState';
import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';

const app = appIn || remote.app;

const gameSupport = {
  skyrim: {
    iniFiles: [
      path.join('{mygames}', 'Skyrim', 'Skyrim.ini'),
      path.join('{mygames}', 'Skyrim', 'SkyrimPrefs.ini'),
    ],
    iniFormat: 'winapi',
  },
  skyrimse: {
    iniFiles: [
      path.join('{mygames}', 'Skyrim Special Edition', 'Skyrim.ini'),
      path.join('{mygames}', 'Skyrim Special Edition', 'SkyrimPrefs.ini'),
    ],
    iniFormat: 'winapi',
  },
  fallout3: {
    iniFiles: [
      path.join('{mygames}', 'Fallout3', 'Fallout.ini'),
      path.join('{mygames}', 'Fallout3', 'FalloutPrefs.ini'),
    ],
    iniFormat: 'winapi',
  },
  fallout4: {
    iniFiles: [
      path.join('{mygames}', 'Fallout4', 'Fallout4.ini'),
      path.join('{mygames}', 'Fallout4', 'Fallout4Prefs.ini'),
    ],
    iniFormat: 'winapi',
  },
  fallout4vr: {
    iniFiles: [
      path.join('{mygames}', 'Fallout4VR', 'Fallout4Custom.ini'),
      path.join('{mygames}', 'Fallout4VR', 'Fallout4Prefs.ini'),
      path.join('{mygames}', 'Fallout4VR', 'Fallout4VrCustom.ini'),
    ],
    iniFormat: 'winapi',
  },
  falloutnv: {
    iniFiles: [
      path.join('{mygames}', 'FalloutNV', 'Fallout.ini'),
      path.join('{mygames}', 'FalloutNV', 'FalloutPrefs.ini'),
    ],
    iniFormat: 'winapi',
  },
  oblivion: {
    iniFiles: [
      path.join('{mygames}', 'Oblivion', 'Oblivion.ini'),
    ],
    iniFormat: 'winapi',
  },
  morrowind: {
    iniFiles: [
      path.join('{game}', 'Morrowind.ini'),
    ],
    iniFormat: 'winapi',
  },
};

export function iniFiles(gameMode: string, discovery: IDiscoveryResult) {
  const mygames = path.join(app.getPath('documents'), 'My Games');

  return getSafe(gameSupport, [gameMode, 'iniFiles'], []).map(file => format(file, {
    mygames, game: discovery.path }));
}

export function iniFormat(gameMode: string) {
  return getSafe(gameSupport, [gameMode, 'iniFormat'], undefined);
}
