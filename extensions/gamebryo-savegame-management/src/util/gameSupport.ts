import { app as appIn, remote } from 'electron';
import * as path from 'path';

const app = appIn || remote.app;

interface IGameSupport {
  mygamesPath: string;
  iniName: string;
  saveFiles: (input: string) => string[];
}

function scriptExtenderFiles(input: string, seext: string): string[] {
  const ext = path.extname(input);
  return [path.basename(input, ext) + '.' + seext];
}

const gameSupport: { [key: string]: IGameSupport } = {
  skyrim: {
    mygamesPath: 'skyrim',
    iniName: 'Skyrim.ini',
    saveFiles: (input: string): string[] => {
      return [].concat([input], scriptExtenderFiles(input, 'skse'));
    },
  },
  skyrimse: {
    mygamesPath: 'Skyrim Special Edition',
    iniName: 'Skyrim.ini',
    saveFiles: (input: string): string[] => {
      return [].concat([input], scriptExtenderFiles(input, 'skse'));
    },
  },
  fallout3: {
    mygamesPath: 'Fallout3',
    iniName: 'Fallout.ini',
    saveFiles: (input: string): string[] => {
      return [].concat([input], scriptExtenderFiles(input, 'fose'));
    },
  },
  fallout4: {
    mygamesPath: 'Fallout4',
    iniName: 'Fallout4.ini',
    saveFiles: (input: string): string[] => {
      return [].concat([input], scriptExtenderFiles(input, 'f4se'));
    },
  },
  fallout4vr: {
    mygamesPath: 'Fallout4VR',
    iniName: 'Fallout4Custom.ini',
    saveFiles: (input: string): string[] => {
      return [].concat([input], scriptExtenderFiles(input, 'f4se'));
    },
  },
  falloutnv: {
    mygamesPath: 'FalloutNV',
    iniName: 'Fallout.ini',
    saveFiles: (input: string): string[] => {
      return [].concat([input], scriptExtenderFiles(input, 'nvse'));
    },
  },
  oblivion: {
    mygamesPath: 'Oblivion',
    iniName: 'Oblivion.ini',
    saveFiles: (input: string): string[] => {
      return [].concat([input], scriptExtenderFiles(input, 'obse'));
    },
  },
};

export function gameSupported(gameMode: string): boolean {
  return gameSupport[gameMode] !== undefined;
}

export function mygamesPath(gameMode: string): string {
  return path.join(app.getPath('documents'), 'My Games',
                   gameSupport[gameMode].mygamesPath);
}

export function iniPath(gameMode: string): string {
  const { iniName } = gameSupport[gameMode];
  return path.join(mygamesPath(gameMode), iniName);
}

export function saveFiles(gameMode: string, savePath: string): string[] {
  return gameSupport[gameMode].saveFiles(savePath);
}
