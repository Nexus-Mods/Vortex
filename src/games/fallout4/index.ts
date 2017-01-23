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
    key: '\\Software\\Wow6432Node\\Bethesda Softworks\\Fallout4',
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
    id: 'FO4Edit',
    name: 'FO4Edit',
    logo: 'tes5edit.png',
    executable: () => 'xedit.exe',
    requiredFiles: [
      'tes5edit.exe',
    ],
  },
  {
    id: 'loot',
    name: 'LOOT',
    logo: 'loot.png',
    executable: () => 'loot.exe',
    parameters: [
      '--game=fallout4',
    ],
    requiredFiles: [
      'loot.exe',
    ],
  },
  {
    id: 'FNIS',
    name: 'FNIS',
    logo: 'fnis.png',
    executable: () => 'GenerateFNISForUsers.exe',
    requiredFiles: [
      'GenerateFNISForUsers.exe',
    ],
  },
];

const game: IGame = {
  id: 'fallout4',
  name: 'Fallout 4',
  mergeMods: true,
  queryPath: findGame,
  supportedTools: tools,
  queryModPath: () => './data',
  logo: 'logo.png',
  executable: () => 'Fallout4.exe',
  requiredFiles: [
    'Fallout4.exe',
  ],
};

export default game;
