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

    return cache[gameId];
  };
})();

export function makeFileUID(repoInfo: IModRepoId): string {
  return ((BigInt(gameNum(repoInfo.gameId)) << BigInt(32))
          | BigInt(parseInt(repoInfo.fileId, 10))).toString();
}
