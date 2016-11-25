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
    key: '\\Software\\Wow6432Node\\Bethesda Softworks\\skyrim',
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
    id: 'TES5Edit',
    name: 'TES5Edit',
    logo: 'tes5edit.png',
    executable: () => 'tes5edit.exe',
    requiredFiles: [
      'tes5edit.exe',
    ],
  },
   {
    id: 'WryeBash',
    name: 'WryeBash',
    logo: 'wrye.png',
    executable: () => 'wryebash.exe',
    requiredFiles: [
      'wryebash.exe',
    ],
  },
  {
    id: 'loot',
    name: 'LOOT',
    logo: 'loot.png',
    executable: () => 'loot.exe',
    parameters: [
      '--game=skyrim',
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
  id: 'skyrim',
  name: 'Skyrim',
  mergeMods: true,
  queryPath: findGame,
  supportedTools: tools,
  queryModPath: () => './data',
  logo: 'logo.png',
  executable: () => 'TESV.exe',
  requiredFiles: [
    'TESV.exe',
  ],
};

export default game;
