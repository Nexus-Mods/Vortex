import { IGame } from '../../types/IGame';
import { log } from '../../util/log';
import Steam, { ISteamEntry } from '../../util/Steam';

import * as Promise from 'bluebird';

import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

function findGame(): Promise<string> {
  let steam = new Steam();
  return steam.allGames()
  .then((games: ISteamEntry[]) => {
    let factorio = games.find((entry: ISteamEntry) => entry.name === 'Factorio');
    if (factorio !== undefined) {
      return factorio.gamePath;
    } else {
      return null;
    }
  })
  .catch((err) => {
    log('debug', 'no steam installed?', { err: err.message });
    return null;
  });
}

function modPath(): string {
  if (process.platform === 'win32') {
    return path.join(remote.app.getPath('appData'), 'Factorio', 'mods');
  } else {
    return path.join(remote.app.getPath('home'), '.factorio', 'mods');
  }
}

function gameExecutable(): string {
  if (process.platform === 'win32') {
    return 'bin/x64/Factorio.exe';
  } else {
    return 'bin/x64/factorio';
  }
}

function prepareForModding(): Promise<void> {
  return fs.ensureDirAsync(modPath());
}

const game: IGame = {
  id: 'factorio',
  name: 'Factorio',
  mergeMods: false,
  queryPath: findGame,
  queryModPath: modPath,
  logo: 'gameart.png',
  executable: gameExecutable,
  requiredFiles: [
    'data/core/graphics/factorio.ico',
  ],
  setup: prepareForModding,
  supportedTools: null,
};

export default game;
