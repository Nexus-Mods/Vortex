import { IGame } from '../../types/IGame';

import * as Promise from 'bluebird';
import Registry = require('winreg');

import { log } from '../../util/log';

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
        log('info', 'reg error', { err });
        reject(err.message);
      } else {
        resolve(result.value);
      }
    });
  });
}

const game: IGame = {
  id: 'skyrim',
  name: 'Skyrim',
  queryGamePath: findGame,
  logo: 'logo.png',
};

export default game;
