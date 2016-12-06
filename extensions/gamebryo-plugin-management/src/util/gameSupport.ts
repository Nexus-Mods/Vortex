import {PluginFormat} from '../util/PluginPersistor';

import { app as appIn, remote } from 'electron';
import * as path from 'path';

const gameSupport = {
  skyrim: {
    appDataPath: 'skyrim',
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
};

export function pluginPath(gameMode: string): string {
  const gamePath = gameSupport[gameMode].appDataPath;
  const app = appIn || remote.app;
  return path.resolve(app.getPath('appData'), '..', 'Local', gamePath);
}

export function pluginFormat(gameMode: string): PluginFormat {
  return gameSupport[gameMode].pluginTXTFormat;
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
