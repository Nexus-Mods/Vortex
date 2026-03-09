/* eslint-disable */
import path from 'path';
import { util } from 'vortex-api';

import { IHaloGame } from './types';

export const MCC_LOCAL_LOW = path.resolve(util.getVortexPath('appData'), '..', 'LocalLow', 'MCC');
export const MOD_MANIFEST_FILE = 'ModManifest.txt';
export const MOD_MANIFEST_FILE_PATH = path.join(MCC_LOCAL_LOW, 'Config', MOD_MANIFEST_FILE);
export const MOD_INFO_JSON_FILE = 'modinfo.json';

export const HALO1_MAPS_RELPATH = path.join('halo1', 'maps');

export const MS_APPID = 'Microsoft.Chelan';
export const STEAM_ID = '976730';
export const GAME_ID = 'halothemasterchiefcollection';

export const MOD_CONFIG_FILE = 'modpack_config.cfg';
export const MOD_CONFIG_DEST_ELEMENT = '$MCC_home\\';
export const ASSEMBLY_EXT = '.asmp';
export const MAP_EXT = '.map';

export const MODTYPE_PLUG_AND_PLAY = 'halo-mcc-plug-and-play-modtype';

// At the time of writing this extension, only Halo: Combat Evolved and Halo Reach were available.
//  We may have to come back to this object as more of the games get released.
export const HALO_GAMES: { [key: string]: IHaloGame } = {
  halo1: { internalId: '1', name: 'Halo: CE', modsPath: 'halo1', img: path.join(__dirname, 'halo1.png') },
  halo2: { internalId: '2', name: 'Halo 2', modsPath: 'halo2', img: path.join(__dirname, 'halo2.png') },
  halo3: { internalId: '3', name: 'Halo 3', modsPath: 'halo3', img: path.join(__dirname, 'halo3.png') },
  // Someone should get Mike a cookie for his premonition skills
  odst: { internalId: '4', name: 'ODST', modsPath: 'halo3odst', img: path.join(__dirname, 'odst.png') },
  halo4: { internalId: '5', name: 'Halo 4', modsPath: 'halo4', img: path.join(__dirname, 'halo4.png') },
  haloreach: { internalId: '6', name: 'Reach', modsPath: 'haloreach', img: path.join(__dirname, 'haloreach.png') },
};