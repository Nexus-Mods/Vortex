import { getSafe } from '../../util/storeHelper';
import { getVortexPath } from '../../util/api';

import * as path from 'path';
import format from 'string-template';
import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';

const gameSupport = {
  skyrim: {
    iniFiles: [
      path.join('{mygames}', 'Skyrim', 'Skyrim.ini'),
      path.join('{mygames}', 'Skyrim', 'SkyrimPrefs.ini'),
    ],
    iniFormat: 'winapi',
  },
  enderal: {
    iniFiles: [
      path.join('{mygames}', 'Enderal', 'Enderal.ini'),
      path.join('{mygames}', 'Enderal', 'EnderalPrefs.ini'),
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
  skyrimvr: {
    iniFiles: [
      path.join('{mygames}', 'Skyrim VR', 'Skyrim.ini'),
      path.join('{mygames}', 'Skyrim VR', 'SkyrimVR.ini'),
      path.join('{mygames}', 'Skyrim VR', 'SkyrimPrefs.ini'),
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
      path.join('{mygames}', 'Fallout4', 'Fallout4Custom.ini'),
    ],
    iniFormat: 'winapi',
  },
  fallout4vr: {
    iniFiles: [
      path.join('{mygames}', 'Fallout4VR', 'Fallout4Custom.ini'),
      path.join('{mygames}', 'Fallout4VR', 'Fallout4Prefs.ini'),
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
  const mygames = path.join(getVortexPath('documents'), 'My Games');

  return getSafe(gameSupport, [gameMode, 'iniFiles'], [])
    .map(file => format(file, { mygames, game: discovery.path }));
}

export function iniFormat(gameMode: string) {
  return getSafe(gameSupport, [gameMode, 'iniFormat'], undefined);
}
