import { nexusGameId } from '../../nexus_integration/util/convertGameId';
import { getGame } from '../../gamemode_management/util/getGame';
import { log } from '../../../util/log';
import { IModRepoId } from '../../mod_management/types/IMod';
import { nexusGames } from '../util';

const gameNum = (() => {
  let cache: { [gameId: string]: number };
  return (gameId: string): number => {
    if (cache === undefined) {
      cache = nexusGames().reduce((prev, game) => {
        prev[game.domain_name] = game.id;
        return prev;
      }, {});
    }

    const game = getGame(gameId);
    return cache[nexusGameId(game, gameId)];
  };
})();

export function makeFileUID(repoInfo: IModRepoId): string {
  
  // check if gameId is numeric and if not, use gameNum() to convert
  const gameIdNum = /^\d+$/.test(repoInfo.gameId)
    ? parseInt(repoInfo.gameId, 10)
    : gameNum(repoInfo.gameId);

  return ((BigInt(gameIdNum) << BigInt(32))
    | BigInt(parseInt(repoInfo.fileId, 10))).toString();
}

export function makeModUID(repoInfo: IModRepoId): string {

  // check if gameId is numeric and if not, use gameNum() to convert
  const gameIdNum = /^\d+$/.test(repoInfo.gameId)
    ? parseInt(repoInfo.gameId, 10)
    : gameNum(repoInfo.gameId);

  return ((BigInt(gameIdNum) << BigInt(32))
    | BigInt(parseInt(repoInfo.modId, 10))).toString();
}

export function makeModAndFileUIDs(gameId: string, modId: string, fileId: string): { modUID: string, fileUID: string } {

  // 1303 518 138454

  const repoInfo = { gameId, modId, fileId };
  if (process.env.NODE_ENV === 'development') {
    log('debug', 'makeModAndFileUIDs', JSON.stringify(repoInfo));
  }

  // Early return if gameId, modId or fileId is missing or invalid
  if (!repoInfo.gameId || !repoInfo.modId || !repoInfo.fileId
    || isNaN(parseInt(repoInfo.modId, 10))
    || isNaN(parseInt(repoInfo.fileId, 10))
  ) {
    return { modUID: undefined, fileUID: undefined };
  }

  const gameIdNum = /^\d+$/.test(repoInfo.gameId)
    ? parseInt(repoInfo.gameId, 10)
    : gameNum(repoInfo.gameId);

  if (gameIdNum === undefined || isNaN(gameIdNum)) {
    return { modUID: undefined, fileUID: undefined };
  }

  return {
    modUID: makeModUID(repoInfo),
    fileUID: makeFileUID(repoInfo)
  };
}
