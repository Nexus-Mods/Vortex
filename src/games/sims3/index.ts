import { IGame } from '../../types/IGame';
import { ITool } from '../../types/ITool';

import * as Promise from 'bluebird';
import Registry = require('winreg');

import { remote } from 'electron';

import * as path from 'path';

function findGame() {
  if (Registry === undefined) {
    // linux ? macos ?
    return null;
  }

  const regKey = new Registry({
    hive: Registry.HKLM,
    key: '\\Software\\Maxis\\The Sims 3',
  });

  return new Promise<string>((resolve, reject) => {
    regKey.get('Install Dir', (err: Error, result: Registry.RegistryItem) => {
      if (err !== null) {
        reject(new Error(err.message));
      } else {
        resolve(result.value);
      }
    });
  });
}

function modPath(): string {
  return path.join(remote.app.getPath('documents'), 'Electronic Arts', 'The Sims 3', 'Mods');
}

let tools: ITool[] = [
  {
    id: 'sevenzip',
    name: '7-Zip',
    executable: () => '7zFM.exe',
    requiredFiles: [
      '7zFM.exe',
    ],
  },
];

const game: IGame = {
  id: 'sims3',
  name: 'The Sims 3',
  mergeMods: false,
  queryPath: findGame,
  queryModPath: modPath,
  logo: 'logo.png',
  executable: () => 'game/bin/TS3.exe',
  requiredFiles: [
    'game/bin/TS3.exe',
  ],
  supportedTools: tools,
};

export default game;
