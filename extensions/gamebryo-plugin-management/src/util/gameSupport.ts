import {PluginFormat} from '../util/PluginPersistor';

import { app as appIn, remote } from 'electron';
import * as path from 'path';

const app = appIn || remote.app;

const gameSupport = {
  skyrim: {
    appDataPath: 'Skyrim',
    pluginTXTFormat: 'original',
    nativePlugins: [
      'skyrim.esm',
      'update.esm',
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
    ],
  },
  falloutnv: {
    appDataPath: 'falloutnv',
    pluginTXTFormat: 'original',
    nativePlugins: [
      'falloutnv.esm',
    ],
  },
};

export function pluginPath(gameMode: string): string {
  const gamePath = gameSupport[gameMode].appDataPath;
  return path.resolve(app.getPath('appData'), '..', 'Local', gamePath);
}

export function lootAppPath(gameMode: string): string {
  const gamePath = gameSupport[gameMode].appDataPath;
  return path.resolve(app.getPath('appData'), '..', 'Local', 'LOOT', gamePath);
}

export function pluginFormat(gameMode: string): PluginFormat {
  return gameSupport[gameMode].pluginTXTFormat;
}

export function supportedGames(): string[] {
  return Object.keys(gameSupport);
}

export function gameSupported(gameMode: string): boolean {
  return gameSupport[gameMode] !== undefined;
}

export function isNativePlugin(gameMode: string, pluginName: string): boolean {
  return gameSupport[gameMode].nativePlugins.indexOf(pluginName.toLowerCase()) !== -1;
}

export function nativePlugins(gameMode: string): string[] {
  return gameSupport[gameMode].nativePlugins;
}
