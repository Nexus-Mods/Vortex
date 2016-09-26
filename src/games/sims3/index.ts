import { IGame } from '../../types/IGame';

import * as Promise from 'bluebird';
import Registry = require('winreg');

import { log } from '../../util/log';

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
        log('info', 'failed to find', err.message);
        reject(err.message);
      } else {
        resolve(result.value);
      }
    });
  });
}

const game: IGame = {
  id: 'sims3',
  name: 'The Sims 3',
  queryGamePath: findGame,
  logo: 'logo.png',
};

export default game;
