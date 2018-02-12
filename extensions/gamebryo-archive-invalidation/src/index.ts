import filesNewer from './util/filesNewer';
import { fileFilter, isSupported, targetAge } from './util/gameSupport';

import * as Promise from 'bluebird';
import * as path from 'path';
import { fs, selectors, types, util } from 'vortex-api';

function testArchivesAge(store: Redux.Store<types.IState>) {
  const gameId = selectors.activeGameId(store.getState());

  if (!isSupported(gameId)) {
    return Promise.resolve(undefined);
  }

  const gamePath: string = util.getSafe(
      store.getState(),
      ['settings', 'gameMode', 'discovered', gameId, 'path'], undefined);

  if (gamePath === undefined) {
    // TODO: happened in testing, but how does one get here with no path configured?
    return Promise.resolve(undefined);
  }

  const game = util.getGame(gameId);
  const dataPath = game.getModPaths(gamePath)[''];

  const age = targetAge(gameId);

  return filesNewer(dataPath, fileFilter(gameId), age)
      .then((files: string[]) => {
        if (files.length === 0) {
          return Promise.resolve(undefined);
        }

        return Promise.resolve({
          description: {
            short: 'Loose files may not get loaded',
            long:
                'Due to oddities in the game engine, some loose files will not ' +
                'get loaded unless we change the filetime on the vanilla BSA files. ' +
                'There is no drawback to doing this.',
          },
          severity: 'warning',
          automaticFix: () => new Promise<void>(
                  (fixResolve, fixReject) =>
                      Promise.map(files, file => fs.utimesAsync(
                                             path.join(dataPath, file),
                                             age.getTime() / 1000,
                                             age.getTime() / 1000))
                          .then((stats: any) => {
                            fixResolve();
                            return Promise.resolve(undefined);
                          })),
        });
      })
      .catch((err: Error) => {
        return Promise.resolve({
          description: {
            short: 'Failed to read bsa/ba2 files.',
            long: err.toString(),
          },
          severity: 'error',
        });
      });
}

function init(context: types.IExtensionContext): boolean {
  context.registerTest('archive-backdate', 'gamemode-activated',
                       () => testArchivesAge(context.api.store));

  return true;
}

export default init;
