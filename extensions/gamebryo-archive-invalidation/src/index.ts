import checkSkyrimFiles from './util/checkSkyrimFiles';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { selectors, types, util } from 'nmm-api';
import * as path from 'path';

function init(context): boolean {

  const testSkyrimAI = () => new Promise<types.ITestResult>((resolve, reject) => {
    let store: Redux.Store<types.IState> = context.api.store;
    let gameId = selectors.activeGameId(store.getState());

    if (gameId !== 'skyrim') {
      return resolve(undefined);
    }

    let messages = 'Skyrim bsa files newer than 2008:';

    let gamePath: string = util.getSafe(store.getState(),
      ['settings', 'gameMode', 'discovered', gameId, 'modPath'], undefined);

    checkSkyrimFiles(store, gameId, gamePath)
      .then((invalidationFiles: string[]) => {

        if (invalidationFiles.length === 0) {
          return resolve(undefined);
        }

        invalidationFiles.forEach(font => {
          messages = messages.concat('\n ' + font);
        });

        return resolve({
          description: {
            short: 'Archive invalidation check.',
            long: messages,
          },
          severity: 'error',
          automaticFix: () => new Promise<void>((fixResolve, fixReject) => {

            return Promise.all(invalidationFiles.map((file) => {
              return fs.statAsync(path.join(gamePath, file))
                .then((stats: any) => {
                  return fs.utimes(path.join(gamePath, file), stats.ctime, 1222819200);
                });
            }))
              .then((stats: any) => {
                fixResolve();
              });
          }),
        });
      })
      .catch((err: Error) => {
        return resolve({
          description: {
            short: 'Failed to read Skyrim bsa files.',
            long: err.toString(),
          },
          severity: 'error',
        });
      });
  });

  context.registerTest('skyrim-AI', 'gamemode-activated', testSkyrimAI);

  return true;
}

export default init;
