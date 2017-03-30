import { IGame } from '../../types/IGame';
import { ITool } from '../../types/ITool';

import { app as appIn, remote } from 'electron';
import * as path from 'path';

import * as Promise from 'bluebird';
import Registry = require('winreg');

const app = appIn || remote.app;

function findGame() {
  if (Registry === undefined) {
    // linux ? macos ?
    return null;
  }

  let regKey = new Registry({
    hive: Registry.HKLM,
    key: '\\Software\\Wow6432Node\\Bethesda Softworks\\oblivion',
  });

  return new Promise<string>((resolve, reject) => {
    regKey.get('Installed Path', (err: Error, result: Registry.RegistryItem) => {
      if (err !== null) {
        reject(new Error(err.message));
      } else {
        resolve(result.value);
      }
    });
  });
}

let tools: ITool[] = [
  {
    id: 'loot',
    name: 'LOOT',
    logo: 'loot.png',
    executable: () => 'loot.exe',
    parameters: [
      '--game=oblivion',
    ],
    requiredFiles: [
      'loot.exe',
    ],
  },
];

const game: IGame = {
  id: 'oblivion',
  name: 'Oblivion',
  mergeMods: true,
  queryPath: findGame,
  supportedTools: tools,
  queryModPath: () => './data',
  logo: 'logo.png',
  executable: () => 'oblivion.exe',
  requiredFiles: [
    'oblivion.exe',
  ],
};

export default game;
