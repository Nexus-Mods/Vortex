import { IGame } from '../../types/IGame';

import * as Promise from 'bluebird';
import Registry = require('winreg');

function findGame() {
  if (Registry === undefined) {
    // linux ? macos ?
    return null;
  }

  const regKey = new Registry({
    hive: Registry.HKLM,
    key: '\\Software\\Maxis\\The Sims 4',
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

const game: IGame = {
  id: 'sims4',
  name: 'The Sims 4',
  queryGamePath: findGame,
  logo: 'logo.png',
  requiredFiles: [
    'game/bin/TS4.exe',
  ],
};

export default game;
