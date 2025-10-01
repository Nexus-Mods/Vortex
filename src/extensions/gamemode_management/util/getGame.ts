import { IGame } from '../../../types/IGame';
import { IGameStore } from '../../../types/IGameStore';
import local from '../../../util/local';
import GameVersionManager from '../../gameversion_management/GameVersionManager';
import GameModeManager, { IGameStub } from '../GameModeManager';
import { IDiscoveryResult } from '../types/IDiscoveryResult';

import { getModTypeExtensions } from './modTypeExtensions';

import * as path from 'path';

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
        if (!defaultPath) {
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
      return (discovery: IDiscoveryResult) =>
        gvm.gameVersionManager.getGameVersion(target, discovery);
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
const gvm = local<{
  gameVersionManager: GameVersionManager,
}>('gameversion-manager', {
  gameVersionManager: undefined,
});

// ...or this
export function getGames(): IGame[] {
  if ($.gameModeManager === undefined) {
    // GameModeManager not initialized yet, return empty array
    return [];
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
    // GameModeManager not initialized yet, return empty array
    return [];
  }

  return $.gameModeManager.gameStores || [];
}

export function getGameStore(id: string): IGameStore {
  if ($.gameModeManager === undefined) {
    // GameModeManager not initialized yet, return undefined
    return undefined;
  }
  return $.gameModeManager.gameStores.find(store => store.id === id);
}
