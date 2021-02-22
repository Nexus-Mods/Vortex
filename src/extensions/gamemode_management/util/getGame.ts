import { IGame } from '../../../types/IGame';
import local from '../../../util/local';
import GameModeManager from '../GameModeManager';

import { getModTypeExtensions } from './modTypeExtensions';

import * as path from 'path';
import { IGameStore } from '../../../types/IGameStore';

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
}>('gamemode-management', {
  gameModeManager: undefined,
});

// ...neither is this
export function getGames(): IGame[] {
  if ($.gameModeManager === undefined) {
    throw new Error('getGames only available in renderer process');
  }
  return $.gameModeManager.games.map(makeGameProxy);
}

export function getGame(gameId: string): IGame {
  if ($.gameModeManager === undefined) {
    throw new Error('getGame only available in renderer process');
  }
  let game = $.gameModeManager.games.find(iter => iter.id === gameId);
  if (game === undefined) {
    const stub = $.gameModeManager.stubs.find(iter => iter.game.id === gameId);
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
