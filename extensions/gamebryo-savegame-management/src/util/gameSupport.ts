import { app as appIn, remote } from 'electron';
import * as path from 'path';

const app = appIn || remote.app;

const gameSupport = {
  skyrim: {
    savesPath: 'skyrim',
  },
  skyrimse: {
    savesPath: 'Skyrim Special Edition',
  },
  fallout4: {
    savesPath: 'Fallout4',
  },
};

export function gameSupported(gameMode: string): boolean {
  return gameSupport[gameMode] !== undefined;
}

export function savesPath(gameMode: string): string {
  const savesPath = gameSupport[gameMode].savesPath;
  return path.join(app.getPath('documents'), 'My Games', savesPath, 'saves');
}
