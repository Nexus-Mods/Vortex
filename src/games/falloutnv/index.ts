import { IGame } from '../../types/IGame';
import { ITool } from '../../types/ITool';

import * as Promise from 'bluebird';
import Registry = require('winreg');

function findGame() {
  if (Registry === undefined) {
    // linux ? macos ?
    return null;
  }

  let regKey = new Registry({
    hive: Registry.HKLM,
    key: '\\Software\\Wow6432Node\\Bethesda Softworks\\falloutnv',
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
      '--game=falloutnv',
    ],
    requiredFiles: [
      'loot.exe',
    ],
  },
];

const game: IGame = {
  id: 'falloutnv',
  name: 'Fallout: New Vegas',
  shortName: 'New Vegas',
  mergeMods: true,
  queryPath: findGame,
  supportedTools: tools,
  queryModPath: () => './data',
  logo: 'gameart.png',
  executable: () => 'FalloutNV.exe',
  requiredFiles: [
    'FalloutNV.exe',
  ],
};

export default game;
