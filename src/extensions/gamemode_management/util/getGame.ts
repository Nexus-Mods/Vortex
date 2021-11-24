import { IGame } from '../../../types/IGame';
import { IGameStore } from '../../../types/IGameStore';
import local from '../../../util/local';
import { log } from '../../../util/log';
import GameModeManager, { IGameStub } from '../GameModeManager';
import { IDiscoveryResult } from '../types/IDiscoveryResult';

import { getModTypeExtensions } from './modTypeExtensions';

import getVersion from 'exe-version';
import * as path from 'path';

function getGameVersion(game: IGame, discovery: IDiscoveryResult) {
  // allow games to have specific functions to get at the version
  // otherwise take the version stored in the executable
  if (discovery?.path === undefined) {
    return Promise.resolve(undefined);
  }
  const getExecGameVersion = () => {
    const exePath = path.join(discovery.path, discovery.executable || game.executable());
    try {
      const version: string = getVersion(exePath);
      return Promise.resolve(version);
    } catch (err) {
      return Promise.resolve('Unknown');
    }
  };

  const getExtGameVersion = async () => {
    try {
      const version: string =
        await game.getGameVersion(discovery.path, discovery.executable || game.executable());
      if (typeof version !== 'string') {
        return Promise.reject(new Error('getGameVersion functor returned an invalid type'));
      }

      return version;
    } catch (err) {
      return Promise.reject(err);
    }
  };

  return (game?.getGameVersion === undefined)
    ? getExecGameVersion()
    : getExtGameVersion()
      .catch(err => {
        log('warn', 'getGameVersion call failed', {
          message: err.message,
          gameMode: game.id,
        });
        return getExecGameVersion();
      });

}

// "decorate" IGame objects with added functionality
const gameExHandler = {
  get: (target: IGame, key: PropertyKey) => {
    if (key === 'getModPaths') {
      const applicableExtensions = getModTypeExtensions().filter(ex => ex.isSupported(target.id));
      const extTypes = applicableExtensions.reduce((prev, val) => {
        const typePath = val.getPath(target);
        if (typePath !== undefined) {
          prev[val.typeId] = typePath;
        }
        return prev;
      }, {});

      return gamePath => {
        let defaultPath = target.queryModPath(gamePath);
        if (defaultPath === undefined) {
          defaultPath = '.';
        }
        if (!path.isAbsolute(defaultPath)) {
          defaultPath = path.resolve(gamePath, defaultPath);
        }
        return {
          ...extTypes,
          '': defaultPath,
        };
      };
    } else if (key === 'modTypes') {
      return getModTypeExtensions().filter(ex => ex.isSupported(target.id));
    } else if (key === 'getInstalledVersion') {
      return (discovery: IDiscoveryResult) => getGameVersion(target, discovery);
    } else {
      return target[key];
    }
  },
};

function makeGameProxy(game: IGame): IGame {
  if (game === undefined) {
    return undefined;
  }
  return new Proxy(game, gameExHandler);
}

// this isn't nice...
const $ = local<{
  gameModeManager: GameModeManager,
  extensionGames: IGame[],
  extensionStubs: IGameStub[],
}>('gamemode-management', {
  gameModeManager: undefined,
  extensionGames: [],
  extensionStubs: [],
});

// ...neither is this
export function getGames(): IGame[] {
  if ($.gameModeManager === undefined) {
    throw new Error('getGames only available in renderer process');
  }
  return $.gameModeManager.games.map(makeGameProxy);
}

export function getGame(gameId: string): IGame {
  let game = $.extensionGames.find(iter => iter.id === gameId);
  if (game === undefined) {
    const stub = $.extensionStubs.find(iter => iter.game.id === gameId);
    if (stub !== undefined) {
      game = stub.game;
    }
  }
  return makeGameProxy(game);
}

export function getGameStores(): IGameStore[] {
  if ($.gameModeManager === undefined) {
    throw new Error('getGameStores only available in renderer process');
  }

  return $.gameModeManager.gameStores || [];
}
