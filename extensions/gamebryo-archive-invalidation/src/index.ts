import filesNewer from './util/filesNewer';
import { fileFilter, isSupported, targetAge } from './util/gameSupport';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { selectors, types, util } from 'nmm-api';
import * as path from 'path';

function testArchivesAge(store: Redux.Store<types.IState>) {
  let gameId = selectors.activeGameId(store.getState());

  if (!isSupported(gameId)) {
    return Promise.resolve(undefined);
  }

  let gamePath: string = util.getSafe(
      store.getState(),
      ['settings', 'gameMode', 'discovered', gameId, 'modPath'], undefined);

  let age = targetAge(gameId);

  return filesNewer(gamePath, fileFilter(gameId), age)
      .then((files: string[]) => {
        if (files.length === 0) {
          return Promise.resolve(undefined);
        }

        return Promise.resolve({
          description: {
            short: 'Loose files may not get loaded',
            long:
                'Due to oddities in the game engine, some loose files will not ' +
                    'get loaded unless we backdate the vanilla BSA files. There ' +
                    'is no drawback to doing this.',
          },
          severity: 'warning',
          automaticFix: () => new Promise<void>((fixResolve, fixReject) => {
                          return Promise.map(files,
                                             file => fs.utimes(
                                                 path.join(gamePath, file),
                                                 age.getTime() / 1000,
                                                 age.getTime() / 1000))
                              .then((stats: any) => {
                                fixResolve();
                                return Promise.resolve(undefined);
                              });
                        }),
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
